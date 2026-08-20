export class AudioCapture {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private worklet: AudioWorkletNode | null = null;
  
  public onData: ((buffer: ArrayBuffer) => void) | null = null;

  async start(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      
      // Load the worklet processor
      await this.ctx.audioWorklet.addModule('/audio-processor.js');
      
      this.source = this.ctx.createMediaStreamSource(this.stream);
      this.worklet = new AudioWorkletNode(this.ctx, 'mic-processor');
      
      this.worklet.port.onmessage = (event) => {
        if (this.onData && event.data) {
          this.onData(event.data);
        }
      };

      this.source.connect(this.worklet);
      
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
    } catch (err) {
      console.error("Microphone access failed", err);
      throw err;
    }
  }

  stop(): void {
    if (this.worklet) {
      this.worklet.disconnect();
      this.worklet = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
  }
}
