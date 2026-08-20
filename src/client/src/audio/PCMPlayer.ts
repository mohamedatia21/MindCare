export class PCMPlayer {
  private ctx: AudioContext;
  private nextStartTime: number = 0;
  private activeNodes: Set<AudioBufferSourceNode> = new Set();
  
  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  cancel(): void {
    for (const node of this.activeNodes) {
      try {
        node.stop();
      } catch (e) {
        // ignore if already stopped
      }
    }
    this.activeNodes.clear();
    // Reset buffer time
    this.nextStartTime = this.ctx.currentTime;
  }

  playChunk(int16Array: Int16Array, sampleRate: number = 24000): void {
    const float32 = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32[i] = int16Array[i] / 32768.0;
    }

    const buffer = this.ctx.createBuffer(1, float32.length, sampleRate);
    buffer.getChannelData(0).set(float32);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.ctx.destination);

    const now = this.ctx.currentTime;
    if (this.nextStartTime < now) {
      this.nextStartTime = now + 0.05; // small jitter buffer
    }

    source.start(this.nextStartTime);
    this.nextStartTime += buffer.duration;
    
    this.activeNodes.add(source);
    source.onended = () => {
      this.activeNodes.delete(source);
    };
  }
}
