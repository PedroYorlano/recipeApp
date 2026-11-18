import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, TouchableOpacity, View } from 'react-native';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { Mic, Pause, Play, RotateCcw, Square } from 'lucide-react-native';
import { Text } from '../ui/Typography';
import { Button } from '../ui/Button';

export type AudioFile = { uri: string; name: string; type: string; webFile?: File };

interface Props {
  /** Manda el audio grabado para armar la receta. */
  onSubmit: (file: AudioFile) => void;
  /** Abre el selector de archivos (notas de voz, etc.). */
  onPickFile: () => void;
  onError: (message: string) => void;
}

/** Tope de grabación: alcanza para dictar una receta y queda lejos del límite de 20 MB. */
const MAX_SECONDS = 5 * 60;

// Mono y 64 kbps: la voz se entiende igual y el archivo pesa la mitad.
const RECORDING_OPTIONS = { ...RecordingPresets.HIGH_QUALITY, numberOfChannels: 1, bitRate: 64000 };

const formatTime = (totalSeconds: number) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Saca un File del blob grabado en el navegador (Chrome graba webm; Safari, mp4). */
const webFileFrom = async (uri: string): Promise<AudioFile> => {
  const blob = await (await fetch(uri)).blob();
  const type = blob.type || 'audio/webm';
  const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
  const name = `receta-dictada.${ext}`;
  return { uri, name, type, webFile: new File([blob], name, { type }) };
};

/**
 * Grabador para dictar una receta: grabar, escuchar, volver a grabar y mandar.
 * También deja elegir un audio que ya esté en el celu.
 */
export function AudioRecorder({ onSubmit, onPickFile, onError }: Props) {
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 250);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  const [starting, setStarting] = useState(false);

  const player = useAudioPlayer(recordedUri ?? null);
  const playerStatus = useAudioPlayerStatus(player);

  const isRecording = recorderState.isRecording;
  const elapsed = recorderState.durationMillis / 1000;

  const start = async () => {
    setStarting(true);
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        onError(
          Platform.OS === 'web'
            ? 'El navegador no nos dejó usar el micrófono. Habilitalo en los permisos del sitio y probá de nuevo.'
            : 'Necesitamos el micrófono para grabar. Habilitalo en Ajustes > Pizca.',
        );
        return;
      }
      if (playerStatus.playing) player.pause();
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecordedUri(null);
    } catch {
      onError('No pudimos empezar a grabar. Probá de nuevo.');
    } finally {
      setStarting(false);
    }
  };

  const stop = async () => {
    const seconds = recorder.getStatus().durationMillis / 1000;
    try {
      await recorder.stop();
      // Sin esto, en iOS la reproducción sale por el auricular y no por el parlante.
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch {
      // Si falla al cortar igual intentamos usar lo que haya quedado grabado.
    }
    if (recorder.uri) {
      setRecordedSeconds(seconds);
      setRecordedUri(recorder.uri);
    } else {
      onError('No se guardó la grabación. Probá de nuevo.');
    }
  };

  // Corte automático al llegar al tope.
  useEffect(() => {
    if (isRecording && elapsed >= MAX_SECONDS) stop();
  }, [isRecording, elapsed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Al terminar de escucharlo, vuelve al principio.
  useEffect(() => {
    if (playerStatus.didJustFinish) {
      player.pause();
      player.seekTo(0);
    }
  }, [playerStatus.didJustFinish, player]);

  const togglePlay = () => {
    if (playerStatus.playing) player.pause();
    else player.play();
  };

  const submit = async () => {
    if (!recordedUri) return;
    if (playerStatus.playing) player.pause();
    try {
      if (Platform.OS === 'web') {
        onSubmit(await webFileFrom(recordedUri));
      } else {
        const ext = recordedUri.split('.').pop()?.toLowerCase() || 'm4a';
        onSubmit({ uri: recordedUri, name: `receta-dictada.${ext}`, type: ext === '3gp' ? 'audio/3gpp' : 'audio/mp4' });
      }
    } catch {
      onError('No pudimos leer la grabación. Probá grabando de nuevo.');
    }
  };

  // Anillo que late mientras graba.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!isRecording) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
    );
    loop.start();
    return () => loop.stop();
  }, [isRecording, pulse]);

  // Ya grabado: escuchar, volver a grabar o mandar.
  if (recordedUri && !isRecording) {
    const duration = playerStatus.duration || recordedSeconds;
    const progress = duration > 0 ? Math.min(1, playerStatus.currentTime / duration) : 0;
    return (
      <View className="gap-4">
        <View className="flex-row items-center gap-3.5 p-4 rounded-[20px] bg-white border border-pizca-linea">
          <TouchableOpacity
            onPress={togglePlay}
            className="w-12 h-12 rounded-full bg-pizca-marron items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel={playerStatus.playing ? 'Pausar' : 'Escuchar la grabación'}
          >
            {playerStatus.playing
              ? <Pause size={20} color="#FFF9EC" fill="#FFF9EC" />
              : <Play size={20} color="#FFF9EC" fill="#FFF9EC" style={{ marginLeft: 2 }} />}
          </TouchableOpacity>
          <View className="flex-1 gap-2">
            <Text className="text-[15px] font-extrabold text-pizca-marron">Tu receta dictada</Text>
            <View className="h-1.5 rounded-full bg-pizca-crema overflow-hidden">
              <View className="h-full rounded-full bg-pizca-albahaca" style={{ width: `${progress * 100}%` }} />
            </View>
          </View>
          <Text className="text-sm font-bold text-pizca-texto2">
            {playerStatus.playing || playerStatus.currentTime > 0 ? formatTime(playerStatus.currentTime) : formatTime(duration)}
          </Text>
        </View>
        <Button title="Armar receta" onPress={submit} />
        <Button
          title="Volver a grabar"
          variant="outline"
          onPress={start}
          loading={starting}
          icon={<RotateCcw size={18} color="#3F3128" strokeWidth={2.4} />}
        />
      </View>
    );
  }

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });

  return (
    <View className="items-center gap-4 pt-2">
      <View className="w-[132px] h-[132px] items-center justify-center">
        {isRecording ? (
          // Por style: NativeWind no aplica className a un Animated.View en web.
          <Animated.View
            style={{
              position: 'absolute', width: 104, height: 104, borderRadius: 52, backgroundColor: '#F95421',
              opacity: ringOpacity, transform: [{ scale: ringScale }],
            }}
          />
        ) : null}
        <TouchableOpacity
          onPress={isRecording ? stop : start}
          disabled={starting}
          activeOpacity={0.85}
          className={`w-[104px] h-[104px] rounded-full items-center justify-center ${isRecording ? 'bg-pizca-tomate-texto' : 'bg-pizca-mostaza'}`}
          style={{ boxShadow: '0 8px 24px rgba(63,49,40,0.18)' }}
          accessibilityRole="button"
          accessibilityLabel={isRecording ? 'Terminar de grabar' : 'Empezar a grabar'}
        >
          {isRecording
            ? <Square size={34} color="#FFFFFF" fill="#FFFFFF" />
            : <Mic size={44} color="#3F3128" strokeWidth={2.2} />}
        </TouchableOpacity>
      </View>

      {isRecording ? (
        <View className="items-center gap-1" accessibilityLiveRegion="polite">
          <Text className="font-display text-[40px] leading-[44px] text-pizca-marron">{formatTime(elapsed)}</Text>
          <Text className="text-sm font-bold text-pizca-texto2">Grabando… tocá para terminar</Text>
          {elapsed > MAX_SECONDS - 30 ? (
            <Text className="text-[13px] font-bold text-pizca-tomate-texto">Corta solo a los {MAX_SECONDS / 60} minutos</Text>
          ) : null}
        </View>
      ) : (
        <>
          <Text className="text-base font-extrabold text-pizca-marron">Tocá para grabar</Text>
          <TouchableOpacity onPress={onPickFile} className="py-2 px-3" accessibilityRole="button">
            <Text className="text-[15px] font-extrabold text-pizca-mostaza-texto underline">O elegí un audio que ya tengas</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}
