// audio-processor.js
// AudioWorkletProcessor runs in a separate thread.
class MicProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0];
      // Downsample float32 to Int16
      const int16Array = new Int16Array(channelData.length);
      for (let i = 0; i < channelData.length; i++) {
        int16Array[i] = Math.max(-32768, Math.min(32767, channelData[i] * 32768));
      }
      // Send data to the main thread
      this.port.postMessage(int16Array.buffer);
    }
    return true; // Keep the processor alive
  }
}

registerProcessor('mic-processor', MicProcessor);
