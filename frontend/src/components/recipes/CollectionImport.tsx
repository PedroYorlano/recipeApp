import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, TouchableOpacity, View, ActivityIndicator, Image } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { ChevronLeft, Check, X, Clock, SkipForward, AlertCircle } from 'lucide-react-native';
import { Text } from '../ui/Typography';
import { Button } from '../ui/Button';
import { ICONS } from '../../constants/brand';
import { ApiError, SessionExpiredError, importCollectionItemService, CollectionVideo } from '../../services/api';
import { getErrorMessage } from '../../utils/dialogs';
import { Category } from '../../types';

export interface CollectionData {
  title: string;
  videos: CollectionVideo[];
  already_imported: string[];
  remaining_today: number;
}

type ItemState =
  | { kind: 'pending' }
  | { kind: 'importing' }
  | { kind: 'done' }
  | { kind: 'skipped' }
  | { kind: 'error'; message: string }
  | { kind: 'later' }; // no entró en el cupo de hoy

interface Props {
  collection: CollectionData;
  categories: Category[];
  onBack: () => void;
  /** Se llama al terminar si se guardó al menos una receta. */
  onImported: () => void;
  onClose: () => void;
}

const KEEP_AWAKE_TAG = 'pizca-coleccion';
const THROTTLE_WAIT_MS = 20_000;
const MAX_THROTTLE_RETRIES = 3;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Importación de una colección de TikTok o una playlist de YouTube, de a un video por vez.
 * Cada receta se guarda sola (privada). Lo maneja el cliente: si se cierra la app se corta, y al
 * volver a pegar el link se saltean las que ya están.
 */
export const CollectionImport = ({ collection, categories, onBack, onImported, onClose }: Props) => {
  const already = useMemo(() => new Set(collection.already_imported), [collection.already_imported]);
  const pending = useMemo(() => collection.videos.filter(v => !already.has(v.url)), [collection.videos, already]);
  const toImport = pending.slice(0, collection.remaining_today);

  const [category, setCategory] = useState<number | null>(null);
  const [phase, setPhase] = useState<'preview' | 'running' | 'finished'>('preview');
  const [states, setStates] = useState<Record<string, ItemState>>({});
  const [stopReason, setStopReason] = useState<string | null>(null);
  const cancelled = useRef(false);

  useEffect(() => () => {
    // Si se cierra la pantalla, se frena después del video en curso.
    cancelled.current = true;
    deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
  }, []);

  const setState = (url: string, state: ItemState) => setStates(prev => ({ ...prev, [url]: state }));

  const run = async () => {
    cancelled.current = false;
    setStopReason(null);
    setPhase('running');
    setStates(Object.fromEntries([
      ...toImport.map(v => [v.url, { kind: 'pending' }]),
      ...pending.slice(toImport.length).map(v => [v.url, { kind: 'later' }]),
    ]));
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});

    let saved = 0;
    for (let i = 0; i < toImport.length; i++) {
      const video = toImport[i];
      if (cancelled.current) break;
      setState(video.url, { kind: 'importing' });

      let retries = 0;
      let stop = false;
      while (true) {
        try {
          const result = await importCollectionItemService(video.url, category);
          if (result.skipped) {
            setState(video.url, { kind: 'skipped' });
          } else {
            setState(video.url, { kind: 'done' });
            saved++;
          }
          break;
        } catch (e) {
          if (e instanceof ApiError && e.status === 429) {
            if ((e.body as { limit?: string } | null)?.limit === 'daily') {
              // Se terminó el cupo del día: lo que queda, otro día.
              for (const rest of toImport.slice(i)) setState(rest.url, { kind: 'later' });
              setStopReason(e.message || 'Llegaste al límite de importaciones de hoy.');
              stop = true;
              break;
            }
            if (retries < MAX_THROTTLE_RETRIES && !cancelled.current) {
              retries++;
              await sleep(THROTTLE_WAIT_MS);
              continue;
            }
          }
          if (e instanceof SessionExpiredError) {
            setState(video.url, { kind: 'error', message: e.message });
            setStopReason(e.message);
            stop = true;
            break;
          }
          setState(video.url, { kind: 'error', message: getErrorMessage(e, 'No pudimos sacar una receta de este video.') });
          break;
        }
      }
      if (stop) break;
    }

    // Lo que no se llegó a procesar (se frenó) vuelve a pendiente.
    setStates(prev => Object.fromEntries(Object.entries(prev).map(([url, s]) => [url, s.kind === 'pending' ? { kind: 'later' } : s])));
    deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    if (!cancelled.current) setPhase('finished');
    if (saved > 0) onImported();
  };

  const counts = Object.values(states).reduce(
    (acc, s) => ({ ...acc, [s.kind]: (acc[s.kind] ?? 0) + 1 }),
    {} as Record<ItemState['kind'], number>,
  );
  const leftForLater = counts.later ?? 0;

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 12, gap: 20, maxWidth: 640, width: '100%', alignSelf: 'center' }}>
      <View className="flex-row items-center gap-3">
        <TouchableOpacity
          onPress={onBack}
          className="w-11 h-11 rounded-full bg-white border border-pizca-linea items-center justify-center"
          accessibilityLabel={phase === 'running' ? 'Frenar' : 'Volver'}
          disabled={phase === 'running'}
        >
          <ChevronLeft size={22} color={phase === "running" ? "#8C7E70" : "#3F3128"} strokeWidth={2.4} />
        </TouchableOpacity>
        <Text className="font-display text-[28px] leading-[30px] text-pizca-marron flex-1" accessibilityRole="header">Importar colección</Text>
      </View>

      {/* Resumen */}
      <View className="p-4 rounded-[20px] bg-white border border-pizca-linea gap-1.5">
        <View className="flex-row items-center gap-2.5">
          <Image source={ICONS.video} style={{ width: 24, height: 24 }} />
          <Text className="text-lg font-extrabold text-pizca-marron flex-1" numberOfLines={2}>{collection.title || 'Colección'}</Text>
        </View>
        <Text className="text-sm text-pizca-texto2">
          {collection.videos.length} {collection.videos.length === 1 ? 'video' : 'videos'}
          {already.size ? ` · ${already.size} ya en tu Pizca` : ''}
          {phase === 'preview' ? ` · te quedan ${collection.remaining_today} importaciones hoy` : ''}
        </Text>
      </View>

      {phase === 'preview' && (
        <>
          {pending.length === 0 ? (
            <Notice text="Ya tenés todas las recetas de esta colección." />
          ) : toImport.length === 0 ? (
            <Notice text="Ya usaste las importaciones de hoy. Volvé mañana con el mismo link y seguimos desde donde quedó." />
          ) : (
            <>
              {toImport.length < pending.length ? (
                <Notice text={`Hoy entran ${toImport.length} de ${pending.length}. Las otras las importás otro día con el mismo link: salteamos las que ya están.`} />
              ) : null}

              {categories.length > 0 && (
                <View className="gap-2">
                  <Text className="text-sm font-extrabold text-pizca-marron">Guardarlas en una categoría (opcional)</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {categories.map(cat => {
                      const selected = category === cat.id;
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          className={`h-9 px-3.5 justify-center rounded-full ${selected ? 'bg-pizca-marron' : 'bg-pizca-crema'}`}
                          onPress={() => setCategory(selected ? null : cat.id)}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: selected }}
                        >
                          <Text className={`text-sm ${selected ? 'font-extrabold text-pizca-fondo' : 'font-bold text-pizca-marron'}`}>{cat.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              <Text className="text-[13px] text-pizca-texto2">
                Las guardamos directo en tu Pizca, privadas. Cada video tarda unos segundos: dejá la app abierta mientras importa.
              </Text>
              <Button title={`Importar ${toImport.length} ${toImport.length === 1 ? 'receta' : 'recetas'}`} onPress={run} />
            </>
          )}
        </>
      )}

      {phase === 'running' && (
        <View className="flex-row items-center gap-3 p-4 rounded-[20px] bg-pizca-crema" accessibilityLiveRegion="polite">
          <ActivityIndicator color="#BE9F00" />
          <Text className="flex-1 text-sm font-bold text-pizca-marron">
            Importando {(counts.done ?? 0) + (counts.skipped ?? 0) + (counts.error ?? 0) + 1} de {toImport.length}. Dejá la app abierta.
          </Text>
          <TouchableOpacity onPress={() => { cancelled.current = true; setPhase('finished'); }} accessibilityRole="button" className="px-2 py-1">
            <Text className="text-sm font-extrabold text-pizca-tomate-texto">Frenar</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === 'finished' && (
        <View className="p-4 rounded-[20px] bg-[#D5E4D3] gap-1" accessibilityLiveRegion="polite">
          <Text className="text-base font-extrabold text-pizca-albahaca">
            {counts.done ? `¡Listo! ${counts.done} ${counts.done === 1 ? 'receta nueva' : 'recetas nuevas'} en tu Pizca.` : 'No se guardó ninguna receta nueva.'}
          </Text>
          {stopReason ? <Text className="text-sm text-pizca-marron">{stopReason}</Text> : null}
          {leftForLater ? (
            <Text className="text-sm text-pizca-marron">
              Quedaron {leftForLater} para otro día: volvé a pegar el link y seguimos desde ahí.
            </Text>
          ) : null}
        </View>
      )}

      {/* Lista de videos */}
      {phase !== 'preview' && (
        <View className="bg-white rounded-[20px] border border-pizca-linea overflow-hidden">
          {pending.map((video, i) => (
            <VideoRow key={`${i}-${video.url}`} video={video} state={states[video.url] ?? { kind: 'later' }} last={i === pending.length - 1} />
          ))}
        </View>
      )}

      {phase === 'finished' && <Button title="Ver mis recetas" onPress={onClose} />}
    </ScrollView>
  );
};

const Notice = ({ text }: { text: string }) => (
  <View className="flex-row gap-2.5 items-start p-4 rounded-[20px] bg-pizca-crema">
    <AlertCircle size={20} color="#6B5A4E" strokeWidth={2.2} />
    <Text className="flex-1 text-sm leading-5 text-pizca-marron">{text}</Text>
  </View>
);

const VideoRow = ({ video, state, last }: { video: CollectionVideo; state: ItemState; last: boolean }) => {
  const label = {
    pending: 'En espera',
    importing: 'Importando…',
    done: 'Guardada',
    skipped: 'Ya estaba',
    later: 'Otro día',
    error: state.kind === 'error' ? state.message : '',
  }[state.kind];
  return (
    <View className={`flex-row items-center gap-3 px-4 py-3 ${last ? '' : 'border-b border-pizca-linea'}`}>
      <View className="w-7 items-center">
        {state.kind === 'importing' ? <ActivityIndicator size="small" color="#BE9F00" />
          : state.kind === 'done' ? <Check size={20} color="#0C4B20" strokeWidth={2.6} />
          : state.kind === 'error' ? <X size={20} color="#B23A12" strokeWidth={2.6} />
          : state.kind === 'skipped' ? <SkipForward size={18} color="#6B5A4E" strokeWidth={2.2} />
          : <Clock size={18} color="#8C7E70" strokeWidth={2.2} />}
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-[15px] font-bold text-pizca-marron" numberOfLines={1}>{video.title || 'Video sin título'}</Text>
        <Text className={`text-[13px] ${state.kind === 'error' ? 'text-pizca-tomate-texto' : 'text-pizca-texto2'}`} numberOfLines={2}>{label}</Text>
      </View>
    </View>
  );
};
