export interface ChatMessagePayload {
  type: 'chat' | 'chat_response' | 'transcript';
  text: string;
  sender?: 'user' | 'mindcare';
  turnId?: string;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manualDisconnect = false;
  private lastTicket: string | null = null;
  private lastSessionId: string | null = null;
  private getFreshTicket: (() => Promise<string>) | null = null;

  private messageQueue: string[] = [];

  public onStateChange: ((state: WSState, backendState?: string) => void) | null = null;
  public onAudioData: ((data: ArrayBuffer) => void) | null = null;
  public onInterrupt: (() => void) | null = null;
  public onChatMessage: ((msg: ChatMessagePayload) => void) | null = null;

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const payload = this.messageQueue.shift();
      if (payload) this.ws.send(payload);
    }
  }

  connect(ticket: string, sessionId: string, ticketRefresher?: () => Promise<string>): Promise<void> {
    this.manualDisconnect = false;
    this.lastTicket = ticket;
    this.lastSessionId = sessionId;
    if (ticketRefresher) this.getFreshTicket = ticketRefresher;

    return new Promise((resolve, reject) => {
      this.onStateChange?.(this.reconnectAttempts > 0 ? 'RECONNECTING' : 'CONNECTING');
      
      let wsUrl = (import.meta.env.VITE_WS_URL as string) || '';
      if (!wsUrl) {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          wsUrl = `${protocol}//localhost:3000`;
        } else {
          // If no VITE_WS_URL is configured on production static host, immediately reject so client seamlessly activates Edge Clinical Engine
          this.onStateChange?.('CONNECTED');
          reject(new Error("No remote WebSocket server configured for static deployment. Activating Edge Clinical Engine."));
          return;
        }
      }
      
      try {
        this.ws = new WebSocket(wsUrl);
        this.ws.binaryType = "arraybuffer";
      } catch (err) {
        this.onStateChange?.('CONNECTED');
        reject(err);
        return;
      }

      const connectionTimeout = setTimeout(() => {
        if (this.ws?.readyState !== WebSocket.OPEN) {
          this.ws?.close();
          this.onStateChange?.('CONNECTED');
          reject(new Error("WebSocket connection timeout"));
        }
      }, 3000);

      this.ws.onopen = () => {
        clearTimeout(connectionTimeout);
        this.reconnectAttempts = 0;
        this.onStateChange?.('AUTHENTICATING');
        
        // Step 1: Send the authentication handshake
        this.ws?.send(JSON.stringify({
          type: 'auth',
          ticket: this.lastTicket,
          sessionId: this.lastSessionId
        }));
      };

      this.ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          this.onAudioData?.(event.data);
        } else {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'auth_success') {
              this.onStateChange?.('CONNECTED');
              this.flushMessageQueue();
              resolve();
            } else if (msg.type === 'state') {
              this.onStateChange?.('CONNECTED', msg.state);
            } else if (msg.type === 'interrupted' || msg.type === 'barge_in_ack') {
              this.onInterrupt?.();
            } else if (msg.type === 'chat_response' || msg.type === 'transcript' || msg.type === 'chat') {
              this.onChatMessage?.(msg);
            }
          } catch (e) {
            console.error("Unknown message format", event.data);
          }
        }
      };

      this.ws.onclose = (e) => {
        clearTimeout(connectionTimeout);
        if (this.manualDisconnect) {
          this.onStateChange?.('DISCONNECTED');
          return;
        }

        if (e.code === 4001) {
          console.warn("WebSocket closed with 4001 (Invalid/Expired Ticket). Triggering reconnect flow.");
          this.onStateChange?.('DISCONNECTED');
          this.attemptReconnect();
          return;
        }

        this.onStateChange?.('DISCONNECTED');
        this.attemptReconnect();
      };

      this.ws.onerror = () => {
        this.onStateChange?.('ERROR');
      };
    });
  }

  private async attemptReconnect(): Promise<void> {
    if (this.manualDisconnect || this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.onStateChange?.('ERROR');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000);
    this.onStateChange?.('RECONNECTING');

    this.reconnectTimer = setTimeout(async () => {
      try {
        let ticketToUse = this.lastTicket;
        if (this.getFreshTicket) {
          ticketToUse = await this.getFreshTicket();
        }
        if (ticketToUse && this.lastSessionId) {
          await this.connect(ticketToUse, this.lastSessionId, this.getFreshTicket || undefined);
        }
      } catch (err) {
        this.attemptReconnect();
      }
    }, delay);
  }

  sendAudio(data: ArrayBuffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  sendChatMessage(text: string): void {
    const payload = JSON.stringify({ type: 'chat', text });
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
    } else {
      this.messageQueue.push(payload);
    }
  }

  sendSettings(settings: any): void {
    const payload = JSON.stringify({ type: 'settings', ...settings });
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
    } else {
      this.messageQueue.push(payload);
    }
  }


  disconnect(): void {
    this.manualDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

