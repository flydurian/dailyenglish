// WAV(PCM s16) → Opus/WebM 서버 측 트랜스코딩
//
// Gemini 3.8 TTS는 WAV(24kHz 16bit mono)만 출력하므로(공식 문서상 MP3/Ogg Opus
// 미지원), 여기서 Opus로 다시 인코딩해 WebM 컨테이너로 감쌉니다. 84초 분량 기준
// 4.0MB WAV → 약 700KB로 줄어 서버리스 응답 한도(4.5MB) 여유가 커지고 전송량도
// 줄어듭니다. WebM 컨테이너는 iOS Safari 17.4+에서 재생되며, Ogg 컨테이너와 달리
// WebKit의 duration 추정 버그(bug 293310)가 없습니다.
//
// WASM(libopus)과 먹서는 무겁기 때문에 TTS 요청에서만 동적 import 합니다.
// 파싱 실패 등은 null 반환으로 처리하고, 호출부가 원본 WAV를 그대로 내려주는
// 폴백 경로를 갖습니다.

// 음성 전용 Opus VBR: 36kbps·complexity 5면 말소리 명료도를 유지하면서
// 64kbps·complexity 10 대비 페이로드 ~40%, 서버리스 WASM CPU 시간을 2~3배 절감합니다.
const TTS_OPUS_BITRATE = 36_000;
const TTS_OPUS_COMPLEXITY = 5;
// 20ms 프레임. 24000/50 = 480 샘플.
const FRAME_MS = 20;

// RFC 7845 Identification Header (OpusHead, 19바이트).
// preskip은 항상 48kHz 기준 샘플 수로 기록합니다 (Opus 내부 출력 레이트).
const buildOpusHead = (channels, inputSampleRate, preskipAt48k) => {
    const head = new Uint8Array(19);
    head.set([0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64]); // "OpusHead"
    head[8] = 1; // version
    head[9] = channels;
    const view = new DataView(head.buffer);
    view.setUint16(10, preskipAt48k, true);
    view.setUint32(12, inputSampleRate, true);
    // output gain(2바이트)=0, channel mapping family(1바이트)=0 (mono/stereo)
    return head;
};

// RIFF/WAVE에서 fmt, data 청크를 찾습니다. LIST 등 부가 청크가 있어도 순회합니다.
export const parseWavChunks = (bytes) => {
    if (bytes.length < 12) return null;
    const riff = String.fromCharCode(...bytes.subarray(0, 4));
    const wave = String.fromCharCode(...bytes.subarray(8, 12));
    if (riff !== 'RIFF' || wave !== 'WAVE') return null;

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 12;
    let fmt = null;
    let data = null;
    while (offset + 8 <= bytes.length) {
        const chunkId = String.fromCharCode(...bytes.subarray(offset, offset + 4));
        const chunkSize = view.getUint32(offset + 4, true);
        if (chunkId === 'fmt ' && !fmt) {
            const p = offset + 8;
            if (offset + 8 + 16 > bytes.length) return null;
            fmt = {
                format: view.getUint16(p, true),
                channels: view.getUint16(p + 2, true),
                sampleRate: view.getUint32(p + 4, true),
                bitsPerSample: view.getUint16(p + 14, true),
            };
        } else if (chunkId === 'data' && !data) {
            data = bytes.subarray(offset + 8, Math.min(offset + 8 + chunkSize, bytes.length));
        }
        offset += 8 + chunkSize + (chunkSize % 2);
    }
    return fmt && data ? { fmt, data } : null;
};

/**
 * WAV(무압축 PCM s16 mono) 바이트를 Opus/WebM으로 변환합니다.
 * @param {Uint8Array} wavBytes Gemini가 반환한 WAV 전체 바이트
 * @returns {Promise<{ webm: Uint8Array, sampleRate: number } | null>}
 *          변환 불가(null) 시 호출부가 원본 WAV를 그대로 응답하는 폴백을 사용합니다.
 */
export const transcodeWavToOpusWebm = async (wavBytes) => {
    try {
        const parsed = parseWavChunks(wavBytes);
        if (!parsed) return null;

        const { fmt, data } = parsed;
        // Gemini TTS 출력은 mono s16입니다. 다른 형태는 검증 없이 폴백으로 넘깁니다.
        if (fmt.format !== 1 || fmt.bitsPerSample !== 16 || fmt.channels !== 1) return null;

        // libopus가 받아들이는 입력 레이트만 처리 (20ms 프레임이 정수 샘플로 나눠떨어짐)
        const sampleRate = fmt.sampleRate;
        if (![8000, 12000, 16000, 24000, 48000].includes(sampleRate)) return null;

        const [{ createEncoder, Application, Signal }, mediabunny] = await Promise.all([
            import('libopus-wasm'),
            import('mediabunny'),
        ]);

        const frameSize = Math.floor((sampleRate * FRAME_MS) / 1000);
        const encoder = await createEncoder({
            sampleRate,
            channels: 1,
            application: Application.Audio,
            signal: Signal.Voice,
            bitrate: TTS_OPUS_BITRATE,
            vbr: true,
            complexity: TTS_OPUS_COMPLEXITY,
            frameSize,
        });

        let packets;
        let preskipAt48k;
        try {
            // data.byteOffset이 홀수면 Int16Array 생성 시 RangeError가 나므로 정렬된 복사본을 씁니다.
            const alignedData = data.byteOffset % 2 === 0 ? data : data.slice();
            const pcm = new Int16Array(alignedData.buffer, alignedData.byteOffset, Math.floor(alignedData.byteLength / 2));
            const frames = [];
            for (let start = 0; start < pcm.length; start += frameSize) {
                const frame = pcm.subarray(start, start + frameSize);
                if (frame.length < frameSize) {
                    // 마지막 부분 프레임은 무음으로 채워 20ms로 만듭니다.
                    const padded = new Int16Array(frameSize);
                    padded.set(frame);
                    frames.push(padded);
                } else {
                    frames.push(frame);
                }
            }
            packets = encoder.encodeFrames(frames);

            // 인코더 지연(lookahead)은 입력 레이트 기준으로 반환되므로 48kHz 단위로 배수합니다.
            preskipAt48k = encoder.getLookahead() * (48000 / sampleRate);
        } finally {
            encoder.free();
        }

        const { Output, BufferTarget, WebMOutputFormat, EncodedAudioPacketSource, EncodedPacket } = mediabunny;
        const output = new Output({ format: new WebMOutputFormat(), target: new BufferTarget() });
        const packetSource = new EncodedAudioPacketSource('opus');
        output.addAudioTrack(packetSource);
        await output.start();

        const decoderConfig = {
            codec: 'opus',
            numberOfChannels: 1,
            sampleRate: 48000,
            description: buildOpusHead(1, sampleRate, preskipAt48k),
        };
        const frameSeconds = frameSize / sampleRate;
        for (let i = 0; i < packets.length; i++) {
            const packet = new EncodedPacket(packets[i], 'key', i * frameSeconds, frameSeconds);
            await packetSource.add(packet, i === 0 ? { decoderConfig } : undefined);
        }
        packetSource.close();
        await output.finalize();

        return { webm: new Uint8Array(output.target.buffer), sampleRate };
    } catch (error) {
        console.error('TTS transcode failed; falling back to WAV:', error);
        return null;
    }
};
