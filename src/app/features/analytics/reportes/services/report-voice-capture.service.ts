import { Injectable } from '@angular/core';

export interface CapturedReportAudio {
  blob: Blob;
  filename: string;
}

const RECORDING_TYPES = [
  { mime: 'audio/webm;codecs=opus', extension: 'webm' },
  { mime: 'audio/webm', extension: 'webm' },
  { mime: 'audio/ogg;codecs=opus', extension: 'ogg' },
  { mime: 'audio/ogg', extension: 'ogg' },
  { mime: 'audio/mp4', extension: 'mp4' },
] as const;

@Injectable({ providedIn: 'root' })
export class ReportVoiceCaptureService {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private version = 0;
  private starting = false;
  private rejectStop: ((reason: Error) => void) | null = null;

  async start(onError: () => void): Promise<void> {
    if (typeof window === 'undefined' || typeof navigator === 'undefined' ||
        typeof MediaRecorder === 'undefined' ||
        typeof MediaRecorder.isTypeSupported !== 'function' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Este navegador no permite grabar audio. Escribe la solicitud manualmente.');
    }
    if (!window.isSecureContext) {
      throw new Error('El micrófono requiere HTTPS o localhost. Escribe la solicitud manualmente.');
    }
    if (this.starting || this.recorder) throw new Error('Ya hay una grabación en curso.');
    const format = RECORDING_TYPES.find((item) => MediaRecorder.isTypeSupported(item.mime));
    if (!format) throw new Error('El navegador no ofrece un formato de audio compatible.');
    const version = ++this.version;
    this.starting = true;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      if (version === this.version) this.starting = false;
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        throw new Error('Permiso de micrófono denegado. Puedes escribir la solicitud.');
      }
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        throw new Error('No se encontró un micrófono disponible.');
      }
      throw new Error('No se pudo acceder al micrófono. Puedes escribir la solicitud.');
    }
    if (version !== this.version) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    try {
      const recorder = new MediaRecorder(stream, { mimeType: format.mime });
      this.stream = stream;
      this.recorder = recorder;
      this.chunks = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.chunks.push(event.data);
      };
      recorder.onerror = () => {
        this.cancel();
        onError();
      };
      recorder.onstop = () => {
        if (this.recorder === recorder) {
          this.cancel();
          onError();
        }
      };
      recorder.start(1000);
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
      this.recorder = null;
      throw new Error('No se pudo iniciar la grabación. Puedes escribir la solicitud.');
    } finally {
      this.starting = false;
    }
  }

  stop(): Promise<CapturedReportAudio> {
    const recorder = this.recorder;
    if (!recorder || recorder.state !== 'recording') {
      return Promise.reject(new Error('No hay una grabación activa.'));
    }
    const mime = recorder.mimeType.split(';', 1)[0];
    const format = RECORDING_TYPES.find((item) => item.mime.split(';', 1)[0] === mime);
    return new Promise((resolve, reject) => {
      this.rejectStop = reject;
      recorder.onstop = () => {
        this.rejectStop = null;
        this.recorder = null;
        const blob = new Blob(this.chunks, { type: mime });
        this.chunks = [];
        if (!format || !blob.size) {
          reject(new Error('La grabación está vacía o no tiene un formato admitido.'));
        } else {
          resolve({ blob, filename: `dictado.${format.extension}` });
        }
      };
      try {
        recorder.stop();
        this.stopTracks();
      } catch {
        this.cancel();
        reject(new Error('No se pudo finalizar la grabación.'));
      }
    });
  }

  cancel(): void {
    this.version++;
    this.starting = false;
    if (this.rejectStop) {
      this.rejectStop(new Error('Grabación cancelada.'));
      this.rejectStop = null;
    }
    const recorder = this.recorder;
    this.recorder = null;
    if (recorder) {
      recorder.onstop = null;
      recorder.ondataavailable = null;
      recorder.onerror = null;
      if (recorder.state !== 'inactive') {
        try { recorder.stop(); } catch { /* Track cleanup still runs below. */ }
      }
    }
    this.stopTracks();
    this.chunks = [];
  }

  private stopTracks(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }
}
