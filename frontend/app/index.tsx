import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Platform, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '../src/components/ui/Button';
import { 
  Link2, 
  Sparkles, 
  ChefHat, 
  Calendar, 
  ShoppingCart, 
  Search, 
  Heart, 
  Flame, 
  Share2, 
  Check, 
  BookOpen, 
  Menu,
  X,
  Play
} from 'lucide-react-native';

export default function LandingPage() {
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const [stepsY, setStepsY] = useState(0);

  const scrollToSteps = () => {
    scrollViewRef.current?.scrollTo({ y: stepsY, animated: true });
  };

  if (Platform.OS !== 'web') {
    return <View style={{ flex: 1, backgroundColor: '#FFF8F0' }} />;
  }

  return (
    <View className="flex-1 bg-[#FFF8F0] min-h-screen">
      {/* 1. Navbar */}
      <View 
        className={`fixed top-0 left-0 right-0 z-50 bg-[#FFF8F0]/95 backdrop-blur-md transition-all duration-300 ${
          isScrolled ? 'shadow-sm border-b border-[#633806]/10 py-3' : 'py-5'
        }`}
      >
        <View className="max-w-7xl mx-auto px-6 flex-row items-center justify-between">
          {/* Logo */}
          <TouchableOpacity 
            onPress={() => router.push('/')} 
            activeOpacity={0.7}
            className="flex-row items-center space-x-2"
          >
            <View className="bg-[#EF9F27]/10 p-1.5 rounded-xl border border-[#EF9F27]/20 mr-2">
              <Flame size={24} color="#EF9F27" strokeWidth={2} />
            </View>
            <Text 
              className="text-2xl font-bold text-[#633806] tracking-tight"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              Fogón
            </Text>
          </TouchableOpacity>

          {/* Desktop Navigation */}
          <View className="hidden md:flex-row items-center space-x-4">
            <Button 
              title="Iniciar sesión" 
              variant="outline" 
              className="px-6 py-2 rounded-xl border-[#633806]/30"
              onPress={() => router.push('/login')}
            />
            <Button 
              title="Registrarse" 
              variant="primary" 
              className="px-6 py-2 rounded-xl"
              onPress={() => router.push('/register')}
            />
          </View>

          {/* Mobile Menu Button */}
          <TouchableOpacity 
            className="md:hidden p-2 rounded-lg bg-[#FAEEDA]/50" 
            onPress={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <X size={24} color="#633806" />
            ) : (
              <Menu size={24} color="#633806" />
            )}
          </TouchableOpacity>
        </View>

        {/* Mobile Navigation Dropdown */}
        {isMobileMenuOpen && (
          <View className="md:hidden bg-[#FFF8F0] border-b border-[#633806]/10 px-6 py-4 space-y-3 absolute top-full left-0 right-0 shadow-lg">
            <Button 
              title="Iniciar sesión" 
              variant="outline" 
              className="w-full py-3 border-[#633806]/30"
              onPress={() => {
                setIsMobileMenuOpen(false);
                router.push('/login');
              }}
            />
            <Button 
              title="Registrarse" 
              variant="primary" 
              className="w-full py-3"
              onPress={() => {
                setIsMobileMenuOpen(false);
                router.push('/register');
              }}
            />
          </View>
        )}
      </View>

      <ScrollView
        ref={scrollViewRef}
        className="flex-1"
        style={Platform.OS === 'web' ? { scrollBehavior: 'smooth' } as any : undefined}
        contentContainerStyle={{ flexGrow: 1 }}
        onScroll={(event) => {
          const y = event.nativeEvent.contentOffset.y;
          setIsScrolled(y > 0);
        }}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={true}
      >
        {/* Hero Spacer */}
        <View className="h-20 md:h-24" />

      {/* 2. Hero Section */}
      <View className="max-w-7xl mx-auto px-6 py-12 md:py-20 lg:py-24">
        <View className="flex-col md:flex-row items-center justify-between gap-12 md:gap-16">
          {/* Left Column (Text) */}
          <View className="flex-1 space-y-6 max-w-2xl">
            <View className="inline-flex flex-row items-center bg-[#3B6D11]/10 px-4 py-1.5 rounded-full border border-[#3B6D11]/25 self-start">
              <Sparkles size={16} color="#3B6D11" className="mr-2" />
              <Text className="text-[#3B6D11] text-sm font-semibold ml-1.5">Inteligencia Artificial en tu cocina</Text>
            </View>
            
            <Text 
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#633806] leading-tight"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              Tu recetario inteligente. Guardá recetas de TikTok e Instagram en segundos.
            </Text>
            
            <Text className="text-[#A89070] text-lg md:text-xl font-normal leading-relaxed">
              Fogón usa inteligencia artificial para transcribir recetas de videos automáticamente. Sin copiar, sin escribir. Solo pegás el link.
            </Text>
            
            <View className="flex-row items-center flex-wrap gap-4 pt-4">
              <Button 
                title="Empezar gratis" 
                variant="primary" 
                className="px-8 py-4 rounded-2xl shadow-md"
                onPress={() => router.push('/register')}
              />
              <Button 
                title="Ver cómo funciona" 
                variant="outline" 
                className="px-8 py-4 rounded-2xl border-[#633806]/30"
                onPress={scrollToSteps}
              />
            </View>
          </View>

          {/* Right Column (Mockup App) */}
          <View className="flex-1 w-full flex items-center justify-center">
            <View className="relative w-full max-w-[390px] aspect-[9/18.5] bg-[#FAEEDA] rounded-[48px] border-[12px] border-[#633806]/90 shadow-2xl overflow-hidden p-0">
              {/* Notch */}
              <View className="absolute top-2 left-1/2 -translate-x-1/2 w-32 h-6 bg-[#633806]/90 rounded-full z-20 flex-row justify-center items-center">
                <View className="w-3.5 h-3.5 bg-black rounded-full mr-2" />
                <View className="w-8 h-1 bg-gray-600 rounded-full" />
              </View>

              <Image 
                source={require('../assets/images/home.jpeg')}
                style={{ width: '100%', height: '100%' }}
                resizeMode="contain"
              />
            </View>
          </View>
        </View>
      </View>

      {/* 3. Cómo funciona */}
      <View 
        nativeID="pasos" 
        onLayout={(e) => setStepsY(e.nativeEvent.layout.y)}
        className="bg-[#FAEEDA]/40 py-20 md:py-28 border-y border-[#633806]/5"
      >
        <View className="max-w-7xl mx-auto px-6">
          <View className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <Text className="text-[#3B6D11] text-sm font-bold uppercase tracking-widest">Paso a paso</Text>
            <Text 
              className="text-4xl font-bold text-[#633806]" 
              style={{ fontFamily: 'Georgia, serif' }}
            >
              Así de simple
            </Text>
            <Text className="text-[#A89070] text-base">
              Olvidate de pausar videos y anotar en papeles. Fogón hace todo el trabajo pesado.
            </Text>
          </View>

          <View className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Step 1 */}
            <View className="bg-[#FFF8F0] p-8 rounded-3xl border border-[#633806]/5 shadow-sm space-y-6 relative overflow-hidden">
              <Text className="absolute -top-3 right-3 text-8xl font-bold text-[#633806]/5" style={{ fontFamily: 'Georgia, serif' }}>1</Text>
              
              <View className="bg-[#EF9F27]/10 w-14 h-14 rounded-2xl items-center justify-center border border-[#EF9F27]/20">
                <Share2 size={28} color="#EF9F27" />
              </View>
              
              <View className="space-y-2">
                <Text className="text-xs font-bold text-[#3B6D11] uppercase tracking-wider">Paso 1</Text>
                <Text className="text-xl font-bold text-[#633806]" style={{ fontFamily: 'Georgia, serif' }}>Compartir el video</Text>
              </View>
              
              <Text className="text-[#A89070] leading-relaxed">
                Copiás el link de cualquier video de TikTok, Instagram o YouTube con una receta que te llamó la atención.
              </Text>
            </View>

            {/* Step 2 */}
            <View className="bg-[#FFF8F0] p-8 rounded-3xl border border-[#633806]/5 shadow-sm space-y-6 relative overflow-hidden">
              <Text className="absolute -top-3 right-3 text-8xl font-bold text-[#633806]/5" style={{ fontFamily: 'Georgia, serif' }}>2</Text>
              
              <View className="bg-[#3B6D11]/10 w-14 h-14 rounded-2xl items-center justify-center border border-[#3B6D11]/20">
                <Sparkles size={28} color="#3B6D11" />
              </View>
              
              <View className="space-y-2">
                <Text className="text-xs font-bold text-[#3B6D11] uppercase tracking-wider">Paso 2</Text>
                <Text className="text-xl font-bold text-[#633806]" style={{ fontFamily: 'Georgia, serif' }}>Importar en un clic</Text>
              </View>
              
              <Text className="text-[#A89070] leading-relaxed">
                Pegás el link en Fogón. La IA escucha el audio, lee la descripción y arma la receta completa con ingredientes y pasos.
              </Text>
            </View>

            {/* Step 3 */}
            <View className="bg-[#FFF8F0] p-8 rounded-3xl border border-[#633806]/5 shadow-sm space-y-6 relative overflow-hidden">
              <Text className="absolute -top-3 right-3 text-8xl font-bold text-[#633806]/5" style={{ fontFamily: 'Georgia, serif' }}>3</Text>
              
              <View className="bg-[#633806]/5 w-14 h-14 rounded-2xl items-center justify-center border border-[#633806]/10">
                <ChefHat size={28} color="#633806" />
              </View>
              
              <View className="space-y-2">
                <Text className="text-xs font-bold text-[#3B6D11] uppercase tracking-wider">Paso 3</Text>
                <Text className="text-xl font-bold text-[#633806]" style={{ fontFamily: 'Georgia, serif' }}>Cocinar y disfrutar</Text>
              </View>
              
              <Text className="text-[#A89070] leading-relaxed">
                La receta queda guardada en tu recetario. La encontrás cuando quieras, escalás las porciones y tachás los ingredientes mientras cocinás.
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* 4. Funcionalidades destacadas */}
      <View className="py-20 md:py-28 max-w-7xl mx-auto px-6">
        <View className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <Text className="text-[#EF9F27] text-sm font-bold uppercase tracking-widest">Características</Text>
          <Text 
            className="text-4xl font-bold text-[#633806]" 
            style={{ fontFamily: 'Georgia, serif' }}
          >
            Todo lo que necesitás en una sola app
          </Text>
          <Text className="text-[#A89070] text-base">
            Diseñamos las herramientas ideales para que organizar tus comidas sea un placer y no una tarea diaria.
          </Text>
        </View>

        <View className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1 */}
          <View className="bg-[#FFF8F0] p-6 rounded-2xl border border-[#633806]/10 hover:-translate-y-1 hover:shadow-md transition-all duration-300 space-y-4">
            <View className="bg-[#EF9F27]/10 w-12 h-12 rounded-xl items-center justify-center border border-[#EF9F27]/20">
              <Link2 size={24} color="#EF9F27" />
            </View>
            <Text className="text-lg font-bold text-[#633806]" style={{ fontFamily: 'Georgia, serif' }}>
              Importación con IA
            </Text>
            <Text className="text-[#A89070] leading-relaxed text-sm">
              Soporta links de TikTok, Instagram, YouTube, blogs de cocina tradicionales y más. Traé tus recetas de donde quieras.
            </Text>
          </View>

          {/* Card 2 */}
          <View className="bg-[#FFF8F0] p-6 rounded-2xl border border-[#633806]/10 hover:-translate-y-1 hover:shadow-md transition-all duration-300 space-y-4">
            <View className="bg-[#EF9F27]/10 w-12 h-12 rounded-xl items-center justify-center border border-[#EF9F27]/20">
              <Calendar size={24} color="#EF9F27" />
            </View>
            <Text className="text-lg font-bold text-[#633806]" style={{ fontFamily: 'Georgia, serif' }}>
              Planner semanal
            </Text>
            <Text className="text-[#A89070] leading-relaxed text-sm">
              Planificá tus comidas de la semana de forma visual. Arrastrá recetas y armá un menú equilibrado en pocos minutos.
            </Text>
          </View>

          {/* Card 3 */}
          <View className="bg-[#FFF8F0] p-6 rounded-2xl border border-[#633806]/10 hover:-translate-y-1 hover:shadow-md transition-all duration-300 space-y-4">
            <View className="bg-[#EF9F27]/10 w-12 h-12 rounded-xl items-center justify-center border border-[#EF9F27]/20">
              <ShoppingCart size={24} color="#EF9F27" />
            </View>
            <Text className="text-lg font-bold text-[#633806]" style={{ fontFamily: 'Georgia, serif' }}>
              Lista de compras
            </Text>
            <Text className="text-[#A89070] leading-relaxed text-sm">
              Olvidate de calcular a ojo. Fogón consolida los ingredientes de tu plan semanal y arma la lista de compras agrupada por góndolas.
            </Text>
          </View>

          {/* Card 4 */}
          <View className="bg-[#FFF8F0] p-6 rounded-2xl border border-[#633806]/10 hover:-translate-y-1 hover:shadow-md transition-all duration-300 space-y-4">
            <View className="bg-[#EF9F27]/10 w-12 h-12 rounded-xl items-center justify-center border border-[#EF9F27]/20">
              <Search size={24} color="#EF9F27" />
            </View>
            <Text className="text-lg font-bold text-[#633806]" style={{ fontFamily: 'Georgia, serif' }}>
              Búsqueda y filtros
            </Text>
            <Text className="text-[#A89070] leading-relaxed text-sm">
              Encontrá cualquier receta en segundos. Filtra por categoría (dulce, salado), tiempo de preparación o ingredientes en tu alacena.
            </Text>
          </View>

          {/* Card 5 */}
          <View className="bg-[#FFF8F0] p-6 rounded-2xl border border-[#633806]/10 hover:-translate-y-1 hover:shadow-md transition-all duration-300 space-y-4">
            <View className="bg-[#EF9F27]/10 w-12 h-12 rounded-xl items-center justify-center border border-[#EF9F27]/20">
              <Heart size={24} color="#EF9F27" />
            </View>
            <Text className="text-lg font-bold text-[#633806]" style={{ fontFamily: 'Georgia, serif' }}>
              Favoritos
            </Text>
            <Text className="text-[#A89070] leading-relaxed text-sm">
              Marcá las recetas que mejor te salen o tus platos preferidos para tenerlos siempre a un toque de distancia.
            </Text>
          </View>

          {/* Card 6 */}
          <View className="bg-[#FFF8F0] p-6 rounded-2xl border border-[#633806]/10 hover:-translate-y-1 hover:shadow-md transition-all duration-300 space-y-4">
            <View className="bg-[#EF9F27]/10 w-12 h-12 rounded-xl items-center justify-center border border-[#EF9F27]/20">
              <Flame size={24} color="#EF9F27" />
            </View>
            <Text className="text-lg font-bold text-[#633806]" style={{ fontFamily: 'Georgia, serif' }}>
              Fogoncito
            </Text>
            <Text className="text-[#A89070] leading-relaxed text-sm">
              Tu asistente virtual de cocina. Preguntale &quot;¿Qué cocino hoy con huevos, papa y cebolla?&quot; y te dará ideas deliciosas al instante.
            </Text>
          </View>
        </View>
      </View>

      {/* 5. Capturas de la app */}
      <View className="bg-[#FAEEDA]/30 py-20 md:py-28 border-y border-[#633806]/5 overflow-hidden">
        <View className="max-w-7xl mx-auto px-6">
          <View className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <Text className="text-[#3B6D11] text-sm font-bold uppercase tracking-widest">Galería</Text>
            <Text 
              className="text-4xl font-bold text-[#633806]" 
              style={{ fontFamily: 'Georgia, serif' }}
            >
              Mirá Fogón en acción
            </Text>
            <Text className="text-[#A89070] text-base">
              Una interfaz minimalista, hogareña y diseñada para ensuciarse las manos cocinando.
            </Text>
          </View>

          {/* Placeholders tilted and centered */}
          <View className="flex-row flex-wrap justify-center items-center gap-10 lg:gap-14 pt-6 max-w-5xl mx-auto">
            {/* Screen 1 (Left - tilted left) */}
            <View 
              className="w-[280px] aspect-[9/19.5] bg-[#FAEEDA] border-4 border-[#633806]/20 rounded-[32px] p-0 shadow-md transform lg:-rotate-3 transition-transform duration-300 hover:rotate-0 hover:scale-105 z-0 overflow-hidden"
              style={Platform.OS === 'web' ? { transform: 'rotate(-3deg)' } as any : undefined}
            >
              <Image 
                source={require('../assets/images/receta_detalle.png')}
                style={{ width: '100%', height: '120%', marginTop: -60 }}
                resizeMode="contain"
              />
            </View>

            {/* Screen 2 (Center - straight) */}
            <View className="w-[290px] aspect-[9/19.5] bg-[#FAEEDA] border-[6px] border-[#633806] rounded-[36px] p-0 shadow-xl z-10 transition-transform duration-300 hover:scale-105 overflow-hidden">
              <Image 
                source={require('../assets/images/planificador.jpeg')}
                style={{ width: '100%', height: '100%' }}
                resizeMode="contain"
              />
            </View>

            {/* Screen 3 (Right - tilted right) */}
            <View 
              className="w-[280px] aspect-[9/19.5] bg-[#FAEEDA] border-4 border-[#633806]/20 rounded-[32px] p-0 shadow-md transform lg:rotate-3 transition-transform duration-300 hover:rotate-0 hover:scale-105 z-0 overflow-hidden"
              style={Platform.OS === 'web' ? { transform: 'rotate(3deg)' } as any : undefined}
            >
              <Image 
                source={require('../assets/images/lista_compras.jpeg')}
                style={{ width: '100%', height: '100%' }}
                resizeMode="contain"
              />
            </View>
          </View>
        </View>
      </View>

      {/* 6. CTA Final */}
      <View className="bg-[#FAEEDA] py-20 md:py-28 border-y border-[#633806]/10">
        <View className="max-w-4xl mx-auto px-6 text-center space-y-8 flex-col items-center">
          <Text 
            className="text-4xl md:text-5xl font-bold text-[#633806] leading-tight" 
            style={{ fontFamily: 'Georgia, serif' }}
          >
            ¿Listo para ordenar tu cocina?
          </Text>
          <Text className="text-[#A89070] text-lg max-w-xl text-center">
            Empezá gratis hoy mismo. No requerimos tarjeta de crédito ni datos complejos. Guardá tus recetas favoritas en un solo lugar.
          </Text>
          <Button 
            title="Crear mi cuenta" 
            variant="primary" 
            className="px-10 py-4 rounded-2xl shadow-lg text-lg"
            onPress={() => router.push('/register')}
          />
        </View>
      </View>

      {/* 7. Footer */}
      <View className="bg-[#633806] py-12 text-[#FFF8F0]">
        <View className="max-w-7xl mx-auto px-6 flex-col md:flex-row items-center justify-between gap-6">
          <View className="flex-row items-center space-x-2">
            <Flame size={20} color="#EF9F27" />
            <Text 
              className="text-xl font-bold tracking-tight text-[#FFF8F0] ml-1"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              Fogón
            </Text>
          </View>

          <View className="flex-row items-center space-x-6">
            <TouchableOpacity onPress={() => router.push('/login')}>
              <Text className="text-sm font-semibold text-[#FAEEDA] hover:underline">Iniciar sesión</Text>
            </TouchableOpacity>
            <Text className="text-[#A89070]/60 text-xs">•</Text>
            <TouchableOpacity onPress={() => router.push('/register')}>
              <Text className="text-sm font-semibold text-[#FAEEDA] hover:underline">Registrarse</Text>
            </TouchableOpacity>
          </View>

          <Text className="text-[#A89070] text-sm font-medium">
            Hecho con ♥ en Córdoba, Argentina
          </Text>
        </View>
      </View>
      </ScrollView>
    </View>
  );
}
