export function computeWaveformPeaks(buffer: AudioBuffer, count: number): number[] {
  const channel = buffer.getChannelData(0);
  const bucket = channel.length / count;
  const stride = Math.max(1, Math.floor(bucket / 1024));
  const peaks: number[] = [];

  for (let index = 0; index < count; index += 1) {
    const start = Math.floor(index * bucket);
    const end = Math.min(channel.length, Math.floor((index + 1) * bucket));
    let peak = 0;
    for (let cursor = start; cursor < end; cursor += stride) {
      const value = Math.abs(channel[cursor]);
      if (value > peak) peak = value;
    }
    peaks.push(peak);
  }

  const max = Math.max(...peaks, 0);
  if (max <= 0) return peaks.map(() => 0);
  return peaks.map((peak) => peak / max);
}

export async function decodeWaveform(blob: Blob, count: number): Promise<number[]> {
  if (typeof OfflineAudioContext === "undefined") {
    throw new Error("当前浏览器不支持 Web Audio");
  }
  const data = await blob.arrayBuffer();
  // 只取包络，低采样率可显著降低长音频的解码内存。
  const context = new OfflineAudioContext(1, 1, 16000);
  const buffer = await context.decodeAudioData(data);
  return computeWaveformPeaks(buffer, count);
}
