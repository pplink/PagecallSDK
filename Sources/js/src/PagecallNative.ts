import type { MediaStat } from "@pagecall/common";
import ListenerController from "./ListenerController";
import RequestController, { Callback } from "./RequestController";

interface ChimeMeetingSessionConfiguration {
  meetingResponse: Record<string, unknown>;
  attendeeResponse: Record<string, unknown>;
}

type PayloadByNativeEvent = {
  audioDevices: MediaDeviceInfo[];
  audioVolume: number;
  remoteAudioStatus: { sessionId: string; muted: boolean };
  mediaStat: MediaStat;
  audioEnded: void;
  videoEnded: void;
  screenshareEnded: void;
  meetingEnded: void;
  error: { name: string; message: string };
};

type NativeEvent = keyof PayloadByNativeEvent;
interface PagecallNativePublic {
  getPlatform: () => "android" | "ios";
  useNativeMediaStore: () => boolean;

  addListener<T extends NativeEvent>(
    eventName: T,
    listener: (payload: PayloadByNativeEvent[T]) => void
  ): void;
  removeListener<T extends NativeEvent>(
    eventName: T,
    listener: (payload: PayloadByNativeEvent[T]) => void
  ): void;

  connect: (configuration: ChimeMeetingSessionConfiguration) => Promise<void>;
  disconnect: () => Promise<void>;

  pauseAudio: () => void;
  resumeAudio: () => void;
  setAudioDevice: (deviceId: number) => void;
  getAudioDevices: () => Promise<MediaDeviceInfo[]>;

  startScreenshare: () => void;
  stopScreenshare: () => void;
}

interface PagecallNativePrivate {
  emit<T extends NativeEvent>(
    eventName: T,
    payload: PayloadByNativeEvent[T]
  ): void;
  response(requestId: string, payload: unknown): void;
}

export type PagecallNativeBridge = PagecallNativePublic & PagecallNativePrivate;

function registerGlobals() {
  const requestController = new RequestController();
  const listenerController = new ListenerController<PayloadByNativeEvent>();

  const postMessage = (
    data: { action: string; payload?: any },
    callback?: Callback
  ) => {
    const { action, payload } = data;
    const requestId = callback
      ? requestController.request(callback)
      : undefined;
    window.webkit.messageHandlers.pagecall.postMessage(
      JSON.stringify({ action, payload, requestId })
    );
  };

  const pagecallNativePublic: Partial<PagecallNativePublic> = {
    getPlatform: () => {
      return "ios";
    },
    useNativeMediaStore: () => {
      return true;
    },

    addListener: <T extends NativeEvent>(
      eventName: T,
      listener: (payload: PayloadByNativeEvent[T]) => void
    ) => {
      listenerController.addListener(eventName, listener);
    },
    removeListener: <T extends NativeEvent>(
      eventName: T,
      listener: (payload: PayloadByNativeEvent[T]) => void
    ) => {
      listenerController.removeListener(eventName, listener);
    },

    pauseAudio: () => {
      postMessage({ action: "pauseAudio" });
    },
    resumeAudio: () => {
      postMessage({ action: "resumeAudio" });
    },
    setAudioDevice: (deviceId: number) => {
      postMessage({ action: "setAudioDevice", payload: { deviceId } });
    },
    getAudioDevices: () => {
      return new Promise<MediaDeviceInfo[]>((resolve, reject) => {
        postMessage(
          { action: "getAudioDevices" },
          (info: MediaDeviceInfo[]) => {
            resolve(info);
          }
        );
      });
    },
  };

  const pagecallNativePrivate: Partial<PagecallNativePrivate> = {
    emit: (eventName, payload) => {
      listenerController.emit(eventName, payload);
    },

    response: (requestId, payload) => {
      requestController.response(requestId, payload);
    },
  };

  window.PagecallNative = { ...pagecallNativePrivate, ...pagecallNativePublic };
}

registerGlobals();