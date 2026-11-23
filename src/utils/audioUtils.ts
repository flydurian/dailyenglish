// 오디오 처리 헬퍼 함수들

// 이미 재생 가능한 포맷인지 확인합니다. audio/l16(raw PCM)만 WAV 변환이 필요합니다.
export const isDirectPlayableAudio = (mimeType: string): boolean => (
  /audio\/(wav|wave|x-wav|webm|mpeg|mp3)/i.test(mimeType || '')
);

export const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i += 1) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
};

// raw PCM(L16) 데이터에 WAV 헤더를 붙여 재생 가능한 Blob을 만듭니다.
export const pcmToWav = (pcmData: Int16Array, sampleRate: number): Blob => {
    const numChannels = 1;
    const bitsPerSample = 16;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const byteRate = sampleRate * blockAlign;
    const dataSize = pcmData.length * (bitsPerSample / 8);
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 36 + dataSize, true);
    view.setUint32(8, 0x57415645, false); // "WAVE"
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, dataSize, true);

    const pcm16 = new Int16Array(pcmData.buffer, pcmData.byteOffset, pcmData.length);
    for (let i = 0; i < pcm16.length; i += 1) {
        view.setInt16(44 + i * 2, pcm16[i], true);
    }

    return new Blob([view], { type: 'audio/wav' });
};
