import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportVoiceCaptureService } from './report-voice-capture.service';

class FakeRecorder {
  static isTypeSupported(mime: string): boolean { return mime === 'audio/webm;codecs=opus'; }
  state: RecordingState = 'inactive';
  mimeType = 'audio/webm;codecs=opus';
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(_stream: MediaStream, _options: MediaRecorderOptions) {}

  start(): void { this.state = 'recording'; }
  stop(): void {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['webm'], { type: 'audio/webm' }) } as BlobEvent);
    this.onstop?.();
  }
}

describe('captura web de dictado CU22', () => {
  const secureDescriptor = Object.getOwnPropertyDescriptor(window, 'isSecureContext');
  const devicesDescriptor = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
  let stopTrack: ReturnType<typeof vi.fn>;
  let stream: MediaStream;
  let service: ReportVoiceCaptureService;

  beforeEach(() => {
    stopTrack = vi.fn();
    stream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true, value: { getUserMedia: vi.fn(async () => stream) },
    });
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    service = new ReportVoiceCaptureService();
  });

  afterEach(() => {
    service.cancel();
    vi.unstubAllGlobals();
    if (secureDescriptor) Object.defineProperty(window, 'isSecureContext', secureDescriptor);
    else Reflect.deleteProperty(window, 'isSecureContext');
    if (devicesDescriptor) Object.defineProperty(navigator, 'mediaDevices', devicesDescriptor);
    else Reflect.deleteProperty(navigator, 'mediaDevices');
  });

  it('negocia WebM, detiene la captura y libera el track', async () => {
    await service.start(vi.fn());
    const audio = await service.stop();
    expect(audio.filename).toBe('dictado.webm');
    expect(audio.blob.type).toBe('audio/webm');
    expect(audio.blob.size).toBeGreaterThan(0);
    expect(stopTrack).toHaveBeenCalledOnce();
  });

  it('libera el track si se cancela durante el permiso pendiente', async () => {
    let grant!: (stream: MediaStream) => void;
    const permission = new Promise<MediaStream>((resolve) => { grant = resolve; });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true, value: { getUserMedia: vi.fn(() => permission) },
    });
    const pending = service.start(vi.fn());
    service.cancel();
    grant(stream);
    await pending;
    expect(stopTrack).toHaveBeenCalledOnce();
  });

  it('comunica permiso denegado sin iniciar grabación', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true, value: { getUserMedia: vi.fn(async () => {
        throw new DOMException('denied', 'NotAllowedError');
      }) },
    });
    await expect(service.start(vi.fn())).rejects.toThrow('Permiso');
    expect(stopTrack).not.toHaveBeenCalled();
  });

  it('mantiene disponible el texto cuando el contexto es inseguro o no hay formato', async () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });
    await expect(service.start(vi.fn())).rejects.toThrow('HTTPS o localhost');
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    vi.stubGlobal('MediaRecorder', class extends FakeRecorder {
      static override isTypeSupported(): boolean { return false; }
    });
    await expect(service.start(vi.fn())).rejects.toThrow('formato de audio compatible');
    expect(stopTrack).not.toHaveBeenCalled();
  });
});
