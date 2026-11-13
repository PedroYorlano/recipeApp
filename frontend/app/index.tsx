import React, { useRef, useState } from 'react';
import { View, TouchableOpacity, Platform, ScrollView, Image, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import { Text } from '../src/components/ui/Typography';
import { ICONS, ILLUSTRATIONS, ISOLOGO } from '../src/constants/brand';

/** Landing pública (solo web; en el celu se va directo al login). */
export default function LandingPage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const [stepsY, setStepsY] = useState(0);

  if (Platform.OS !== 'web') {
    return <View style={{ flex: 1, backgroundColor: '#FFF9EC' }} />;
  }

  const wide = width >= 900;
  const narrow = width < 480;
  const heroSize = Math.max(44, Math.min(76, width * 0.06));
  const scrollToSteps = () => scrollRef.current?.scrollTo({ y: stepsY, animated: true });

  const PrimaryCta = ({ title, big, compact }: { title: string; big?: boolean; compact?: boolean }) => (
    <TouchableOpacity
      onPress={() => router.push('/register')}
      className={`${big ? 'h-14 px-7' : compact ? 'h-10 px-3.5' : 'h-11 px-5'} rounded-[16px] bg-pizca-mostaza items-center justify-center`}
      accessibilityRole="link"
    >
      <Text className={`${big ? 'text-[17px]' : compact ? 'text-[15px]' : 'text-base'} font-extrabold text-pizca-marron`}>{title}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView ref={scrollRef} className="flex-1 bg-pizca-fondo" contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      {/* Nav */}
      {/* Un solo renglón también en el celular: en pantallas angostas todo se achica. */}
      <View className={`w-full max-w-[1160px] self-center ${narrow ? 'px-4 gap-2' : 'px-6 gap-4'} py-5 flex-row items-center justify-between`}>
        <TouchableOpacity className={`flex-row items-center shrink ${narrow ? 'gap-1.5' : 'gap-2.5'}`} accessibilityRole="link" accessibilityLabel="Pizca, inicio">
          <Image source={ISOLOGO} style={narrow ? { width: 34, height: 27 } : { width: 45, height: 36 }} resizeMode="contain" />
          <Text className={`font-display text-pizca-mostaza ${narrow ? 'text-[24px] leading-[26px]' : 'text-[30px] leading-[32px]'}`}>PIZCA</Text>
        </TouchableOpacity>
        <View className={`flex-row items-center ${narrow ? 'gap-0.5' : 'gap-2'}`}>
          {wide ? (
            <TouchableOpacity onPress={scrollToSteps} className="px-3.5 py-2.5" accessibilityRole="link">
              <Text className="font-bold text-pizca-marron text-base">Cómo funciona</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={() => router.push('/login')} className={narrow ? 'px-2.5 py-2.5' : 'px-3.5 py-2.5'} accessibilityRole="link">
            <Text className={`font-bold text-pizca-marron ${narrow ? 'text-[15px]' : 'text-base'}`}>Ingresar</Text>
          </TouchableOpacity>
          <PrimaryCta title="Crear cuenta" compact={narrow} />
        </View>
      </View>

      {/* Hero */}
      <View className={`w-full max-w-[1160px] self-center px-6 pt-12 pb-[72px] gap-12 ${wide ? 'flex-row items-center' : ''}`}>
        <View className="flex-1 gap-6 min-w-0">
          <View className="self-start flex-row items-center gap-2 px-3.5 py-2 rounded-full bg-pizca-crema">
            <Image source={ICONS.guardado} style={{ width: 16, height: 16 }} />
            <Text className="text-sm font-extrabold text-pizca-marron">Tu recetario, siempre a mano</Text>
          </View>
          <Text className="font-display text-pizca-marron" style={{ fontSize: heroSize, lineHeight: heroSize * 1.04 }} accessibilityRole="header">
            Te faltaba una <Text className="font-display text-pizca-tomate">pizca</Text> de orden.
          </Text>
          <Text className="text-xl leading-[31px] text-pizca-texto2 max-w-[540px]">
            Guardá las recetas que encontrás en TikTok, Instagram, YouTube o cualquier blog. Pizca las pasa en limpio:
            ingredientes, pasos y porciones, listas para cocinar.
          </Text>
          <View className="flex-row gap-3 flex-wrap">
            <PrimaryCta title="Empezar gratis" big />
            <TouchableOpacity
              onPress={scrollToSteps}
              className="h-14 px-6 rounded-[16px] border-[1.5px] border-pizca-marron items-center justify-center"
              accessibilityRole="link"
            >
              <Text className="text-[17px] font-extrabold text-pizca-marron">Ver cómo funciona</Text>
            </TouchableOpacity>
          </View>
          <View className="flex-row items-center gap-3 flex-wrap">
            <Text className="text-sm font-bold text-pizca-texto2">Traé recetas desde</Text>
            <View className="flex-row gap-1.5">
              {[ICONS.web, ICONS.video, ICONS.audio, ICONS.texto].map((icon, i) => (
                <View key={i} className="w-9 h-9 rounded-[10px] bg-pizca-crema items-center justify-center">
                  <Image source={icon} style={{ width: 22, height: 22 }} />
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Teléfono ilustrativo */}
        <View className="flex-1 items-center justify-center py-6 min-w-0" accessible={false}>
          <Image source={ILLUSTRATIONS.zanahoria} style={{ position: 'absolute', left: '4%', top: '6%', width: 75, height: 92, transform: [{ rotate: '-18deg' }] }} resizeMode="contain" />
          <Image source={ILLUSTRATIONS.tomate} style={{ position: 'absolute', right: '4%', top: '16%', width: 68, height: 70 }} resizeMode="contain" />
          <Image source={ILLUSTRATIONS.nabo} style={{ position: 'absolute', left: '8%', bottom: '8%', width: 70, height: 80 }} resizeMode="contain" />
          <Image source={ILLUSTRATIONS.morron} style={{ position: 'absolute', right: '6%', bottom: '4%', width: 82, height: 86, transform: [{ rotate: '12deg' }] }} resizeMode="contain" />
          <View className="w-[290px] rounded-[40px] bg-pizca-marron p-2.5" style={{ boxShadow: '0 30px 60px rgba(63,49,40,0.25)' }}>
            <View className="rounded-[32px] overflow-hidden bg-pizca-fondo">
              <View className="h-[170px] bg-[#EFE3B0] items-center justify-center">
                <Image source={ILLUSTRATIONS.hongo} style={{ width: 90, height: 80 }} resizeMode="contain" />
              </View>
              <View className="px-[18px] pt-4 pb-5 gap-2.5">
                <Text className="font-display text-2xl leading-[26px] text-pizca-marron">Pasta cremosa con hongos</Text>
                <Text className="text-xs font-bold text-pizca-texto2">35 min · 4 porciones</Text>
                <View className="gap-2 p-3 rounded-[16px] bg-white">
                  <View className="flex-row gap-2 items-center">
                    <View className="w-4 h-4 rounded-[5px] bg-pizca-albahaca items-center justify-center"><Check size={11} color="#FFFFFF" strokeWidth={3.2} /></View>
                    <Text className="text-[13px] text-pizca-texto2 line-through">250 g de fideos</Text>
                  </View>
                  <View className="flex-row gap-2 items-center">
                    <View className="w-4 h-4 rounded-[5px] border-[1.5px] border-pizca-marron" />
                    <Text className="text-[13px] text-pizca-marron"><Text className="font-extrabold">200 g</Text> de hongos</Text>
                  </View>
                  <View className="flex-row gap-2 items-center">
                    <View className="w-4 h-4 rounded-[5px] border-[1.5px] border-pizca-marron" />
                    <Text className="text-[13px] text-pizca-marron"><Text className="font-extrabold">1 taza</Text> de crema</Text>
                  </View>
                </View>
                <View className="h-11 rounded-[14px] bg-pizca-albahaca items-center justify-center">
                  <Text className="text-sm font-extrabold text-white">Agregar a la semana</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Cómo funciona */}
      <View className="bg-pizca-crema px-6 py-20" onLayout={e => setStepsY(e.nativeEvent.layout.y)}>
        <View className="w-full max-w-[1160px] self-center gap-10">
          <View className="gap-2.5 max-w-[640px]">
            <Text className="text-sm font-extrabold tracking-widest uppercase text-pizca-albahaca">Cómo funciona</Text>
            <Text className="font-display text-[44px] leading-[46px] text-pizca-marron" accessibilityRole="header">De un link a tu cocina, en tres pasos</Text>
          </View>
          <View className="flex-row flex-wrap gap-5">
            <StepCard n={1} color="bg-pizca-mostaza" title="Importá" text="Compartí el video o pegá el link. También podés dictarla o pegar el texto." />
            <StepCard n={2} color="bg-pizca-ambar" title="Ordená" text="Pizca la convierte en una receta clara, con cantidades, pasos y categorías." />
            <StepCard n={3} color="bg-pizca-albahaca" light title="Cociná" text="Ajustá las porciones, tachá ingredientes y sumala al plan de la semana." />
          </View>
        </View>
      </View>

      {/* Funciones */}
      <View className="w-full max-w-[1160px] self-center px-6 py-20 gap-10">
        <Text className="font-display text-[44px] leading-[46px] text-pizca-marron max-w-[640px]" accessibilityRole="header">Todo en un solo lugar</Text>
        <View className="flex-row flex-wrap gap-5">
          <Feature icon={ICONS.web} title="Desde donde sea" text="TikTok, Instagram, YouTube, blogs, audio o texto." />
          <Feature icon={ICONS.almuerzo} title="Plan de la semana" text="Elegí qué desayunar, almorzar y cenar cada día." />
          <Feature icon={ICONS.compras} title="Lista de compras" text="Se arma sola con los ingredientes de tu plan." />
          <Feature icon={ICONS.categorias} title="Buscá y filtrá" text="Por nombre, ingrediente, categoría o favoritas." />
          <Feature icon={ICONS.ingredientes} title="Ideas con lo que tenés" text="Contale qué hay en la heladera y te sugiere recetas tuyas." />
          <Feature icon={ICONS.favoritos} title="Compartí" text="Mandá un link y cualquiera la ve, aunque no tenga cuenta." />
        </View>
      </View>

      {/* CTA final */}
      <View className="px-6 pb-20">
        <View className={`w-full max-w-[1160px] self-center rounded-[32px] bg-pizca-albahaca px-10 py-14 gap-8 overflow-hidden ${wide ? 'flex-row items-center justify-between' : ''}`}>
          <View className="gap-3 max-w-[560px] flex-shrink">
            <Text className="font-display text-[48px] leading-[49px] text-white">Una pizca alcanza.</Text>
            <Text className="text-lg leading-[27px] text-[#E4EDE3]">
              Creá tu cuenta y guardá tu primera receta en menos de un minuto. Usala desde el navegador o agregala a la
              pantalla de inicio del celu.
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/register')}
            className="h-14 px-7 rounded-[16px] bg-pizca-ambar items-center justify-center self-start"
            accessibilityRole="link"
          >
            <Text className="text-[17px] font-extrabold text-pizca-marron">Crear mi cuenta gratis</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Pie */}
      <View className="w-full max-w-[1160px] self-center px-6 pt-6 pb-10 border-t border-pizca-linea flex-row items-center justify-between flex-wrap gap-4">
        <View className="flex-row items-center gap-2">
          <Image source={ISOLOGO} style={{ width: 27, height: 22 }} resizeMode="contain" />
          <Text className="text-sm text-pizca-texto2">Pizca · hecho en Córdoba</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/login')} accessibilityRole="link">
          <Text className="text-sm font-bold text-pizca-mostaza-texto">Ingresar</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const StepCard = ({ n, color, light, title, text }: { n: number; color: string; light?: boolean; title: string; text: string }) => (
  <View className="flex-1 basis-[280px] bg-white rounded-[24px] p-7 gap-3">
    <View className={`w-10 h-10 rounded-full items-center justify-center ${color}`}>
      <Text className={`text-lg font-extrabold ${light ? 'text-white' : 'text-pizca-marron'}`}>{n}</Text>
    </View>
    <Text className="text-[22px] font-extrabold text-pizca-marron">{title}</Text>
    <Text className="text-base leading-[25px] text-pizca-texto2">{text}</Text>
  </View>
);

const Feature = ({ icon, title, text }: { icon: ImageSourcePropType; title: string; text: string }) => (
  <View className="flex-1 basis-[320px] flex-row gap-4 p-6 rounded-[24px] bg-white border border-pizca-linea">
    <View className="w-14 h-14 rounded-[16px] bg-pizca-crema items-center justify-center">
      <Image source={icon} style={{ width: 32, height: 32 }} />
    </View>
    <View className="flex-1 gap-1.5">
      <Text className="text-lg font-extrabold text-pizca-marron">{title}</Text>
      <Text className="text-[15px] leading-[22px] text-pizca-texto2">{text}</Text>
    </View>
  </View>
);
