import { MaterialIcons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { PieChart } from 'react-native-chart-kit';

const screenWidth = Dimensions.get('window').width;

// Paleta de colores del mockup (verdes oscuros a claros)
const COLORS = ['#1B3012', '#2D4B1D', '#4A6B3A', '#6D8C5B', '#A3B899', '#C5D6BD'];

// Mapeo de módulo EPI → nombre, jurisdicción/zona, número
const EPI_INFO: { [key: string]: { name: string; nameUpper: string; jurisdiction: string; zona: string; numero: string } } = {
  'EPI_N1_Coña Coña': {
    name: 'EPI N°1 Coña Coña',
    nameUpper: 'EPI N°1 COÑA COÑA',
    jurisdiction: 'Jurisdicción Oeste',
    zona: 'Zona Oeste',
    numero: '1',
  },
  'EPI_N3_Jaihuayco': {
    name: 'EPI N°3 Jaihuayco',
    nameUpper: 'EPI N°3 JAIHUAYCO',
    jurisdiction: 'Jurisdicción Aeropuerto',
    zona: 'Zona Norte',
    numero: '3',
  },
  'EPI_N5_Alalay': {
    name: 'EPI N°5 Alalay',
    nameUpper: 'EPI N°5 ALALAY',
    jurisdiction: 'Jurisdicción Sudeste',
    zona: 'Zona Central',
    numero: '5',
  },
  'EPI_N6_Central': {
    name: 'EPI N°6 Central',
    nameUpper: 'EPI N°6 CENTRAL',
    jurisdiction: 'Jurisdicción Centro',
    zona: 'Zona Central',
    numero: '6',
  },
  'EPI_N7_Sur': {
    name: 'EPI N°7 Sur',
    nameUpper: 'EPI N°7 SUR',
    jurisdiction: 'Jurisdicción Pucara',
    zona: 'Zona Sur',
    numero: '7',
  },
};

const getEPIName = (raw: string) => EPI_INFO[raw]?.name || raw;
const getEPINameUpper = (raw: string) => EPI_INFO[raw]?.nameUpper || raw.toUpperCase();
const getJurisdiction = (raw: string) => EPI_INFO[raw]?.jurisdiction || 'Jurisdicción General';
const getZona = (raw: string) => EPI_INFO[raw]?.zona || 'Zona General';
const getEPINumber = (raw: string) => EPI_INFO[raw]?.numero || '-';

const EstadisticasScreen = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const API_URL = 'https://safecity-1.onrender.com/estadisticas';

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(API_URL);
        const json = await response.json();
        if (json.success) {
          setStats(json.data);
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1B3012" />
        <Text style={styles.loadingText}>Cargando estadísticas...</Text>
      </View>
    );
  }

  if (!stats) return null;

  // Datos para el gráfico de dona
  const chartData = stats.porEPI.map((item: any, index: number) => ({
    name: item.modulo_epi,
    population: item.cantidad,
    color: COLORS[index % COLORS.length],
    legendFontColor: '#7F7F7F',
    legendFontSize: 15,
  }));

  const epiMasCasos = stats.porEPI.length > 0 ? stats.porEPI[0] : null;
  const porcentajeTipoFrecuente = stats.tipoFrecuente
    ? Math.round((stats.tipoFrecuente.cantidad / stats.total) * 100)
    : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* HEADER — simple y plano, igual que el mockup */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reportes Estadísticos</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* SECCIÓN: GRÁFICO DE DONA + LEYENDA */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>REPORTES POR EPI</Text>

          <View style={styles.chartWrapper}>
            <PieChart
              data={chartData}
              width={screenWidth - 64}
              height={200}
              chartConfig={{ color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})` }}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="80"
              hasLegend={false}
              absolute
            />
            {/* Agujero central — efecto dona */}
            <View style={styles.donutHole}>
              <Text style={styles.donutTotal}>{stats.total}</Text>
              <Text style={styles.donutLabel}>TOTAL</Text>
            </View>
          </View>

          {/* Leyenda en dos columnas */}
          <View style={styles.legendContainer}>
            {stats.porEPI.map((item: any, index: number) => {
              const pct = Math.round((item.cantidad / stats.total) * 100);
              return (
                <View key={index} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: COLORS[index % COLORS.length] }]} />
                  <Text style={styles.legendText} numberOfLines={1}>
                    {getEPIName(item.modulo_epi)} ({pct}%)
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* SECCIÓN: DOS TARJETAS DE RESUMEN */}
        <View style={styles.gridContainer}>
          {/* EPI con más denuncias */}
          <View style={styles.smallCard}>
            <Text style={styles.smallCardLabel}>EPI CON MÁS DENUNCIAS</Text>
            <Text style={styles.smallCardValue} numberOfLines={2}>
              {epiMasCasos ? getEPIName(epiMasCasos.modulo_epi) : 'N/A'}
            </Text>
            <Text style={styles.highlightRed}>
              {epiMasCasos ? `${epiMasCasos.cantidad} Casos` : '0 Casos'}
            </Text>
          </View>

          {/* Tipo de denuncia más frecuente */}
          <View style={styles.smallCard}>
            <Text style={styles.smallCardLabel}>TIPO DE DENUNCIA MÁS FRECUENTE</Text>
            <Text style={styles.smallCardValue} numberOfLines={2}>
              {stats.tipoFrecuente ? stats.tipoFrecuente.tipo : 'N/A'}
            </Text>
            <Text style={styles.highlightGreen}>
              {porcentajeTipoFrecuente}% del Total
            </Text>
          </View>
        </View>

        {/* SECCIÓN: ZONA DE MAYOR CRIMINALIDAD */}
        {/* Muestra la EPI con más casos + su zona/jurisdicción, igual que el mockup */}
        <View style={[styles.card, styles.rowCard]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.smallCardLabel}>ZONA DE MAYOR CRIMINALIDAD</Text>
            <Text style={styles.zoneText}>
              {epiMasCasos
                ? `${getEPINameUpper(epiMasCasos.modulo_epi)} / ${getZona(epiMasCasos.modulo_epi).toUpperCase()}`
                : 'N/A'}
            </Text>
          </View>
          <View style={styles.iconRedBg}>
            <MaterialIcons name="location-on" size={24} color="#DC2626" />
          </View>
        </View>

        {/* SECCIÓN: CRIMEN FRECUENTE POR EPI */}
        <View style={[styles.card, styles.listCard]}>
          {/* Cabecera de la lista */}
          <View style={styles.listHeader}>
            <Text style={styles.listHeaderTitle}>Crimen Frecuente por EPI</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>MENSUAL</Text>
            </View>
          </View>

          {/* Filas */}
          {stats.crimenPorEPI.map((item: any, index: number) => {
            const isMostDangerous = item.modulo_epi === epiMasCasos?.modulo_epi;
            return (
              <View
                key={index}
                style={[styles.listItem, isMostDangerous && styles.listItemDanger]}
              >
                <View style={styles.listItemLeft}>
                  <View style={[styles.listBubble, isMostDangerous && styles.listBubbleDanger]}>
                    <Text style={[styles.listBubbleText, isMostDangerous && styles.listBubbleTextDanger]}>
                      {getEPINumber(item.modulo_epi)}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.listEpiName}>{getEPIName(item.modulo_epi)}</Text>
                    <Text style={styles.listJurisdiction}>{getJurisdiction(item.modulo_epi)}</Text>
                  </View>
                </View>
                <View style={[styles.crimeBadge, isMostDangerous && styles.crimeBadgeDanger]}>
                  <Text style={[styles.crimeBadgeText, isMostDangerous && styles.crimeBadgeTextDanger]}>
                    {item.tipo}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F0EFE9' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0EFE9' },
  loadingText: { marginTop: 10, color: '#1B3012', fontWeight: 'bold' },

  // ── HEADER (simple, plano, igual al mockup y a RegistroNoticia) ──
  header: {
    backgroundColor: '#1B3012',
    paddingTop: Platform.OS === 'android' ? 48 : 56,
    paddingBottom: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#E5E5E5',
  },

  scrollContent: { padding: 16, paddingBottom: 80 },

  // ── TARJETAS BASE ──
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1B3012',
    letterSpacing: 1.2,
    marginBottom: 8,
  },

  // ── DONA ──
  chartWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
  },
  donutHole: {
    position: 'absolute',
    width: 88,
    height: 88,
    backgroundColor: '#fff',
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  donutTotal: { fontSize: 22, fontWeight: 'bold', color: '#1B3012' },
  donutLabel: { fontSize: 10, fontWeight: 'bold', color: '#9CA3AF', letterSpacing: 1 },

  // ── LEYENDA ──
  legendContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, paddingHorizontal: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', width: '50%', marginBottom: 10 },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 7 },
  legendText: { fontSize: 12, fontWeight: '600', color: '#374151', flexShrink: 1 },

  // ── GRID DE DOS TARJETAS ──
  gridContainer: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  smallCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    minHeight: 110,
    justifyContent: 'space-between',
  },
  smallCardLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#9CA3AF',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  smallCardValue: { fontSize: 16, fontWeight: 'bold', color: '#1B3012', marginBottom: 4 },
  highlightRed: { fontSize: 13, fontWeight: 'bold', color: '#DC2626' },
  highlightGreen: { fontSize: 13, fontWeight: 'bold', color: '#2D4B1D' },

  // ── ZONA DE MAYOR CRIMINALIDAD ──
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
  },
  zoneText: { fontSize: 16, fontWeight: 'bold', color: '#1B3012', marginTop: 6 },
  iconRedBg: {
    backgroundColor: '#FEE2E2',
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── LISTADO ──
  listCard: { padding: 0, overflow: 'hidden' },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  listHeaderTitle: { fontSize: 14, fontWeight: 'bold', color: '#1B3012' },
  badge: {
    backgroundColor: '#1B3012',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },

  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  listItemDanger: { backgroundColor: 'rgba(254,226,226,0.45)' },
  listItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },

  listBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F0EFE9',
    borderWidth: 1,
    borderColor: 'rgba(27,48,18,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listBubbleDanger: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
  listBubbleText: { fontSize: 15, fontWeight: 'bold', color: '#1B3012' },
  listBubbleTextDanger: { color: '#DC2626' },

  listEpiName: { fontSize: 14, fontWeight: 'bold', color: '#111827' },
  listJurisdiction: { fontSize: 11, color: '#6B7280', marginTop: 2 },

  crimeBadge: {
    backgroundColor: '#2D4B1D',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  crimeBadgeDanger: { backgroundColor: '#2D4B1D' },
  crimeBadgeText: { fontSize: 12, fontWeight: 'bold', color: '#fff' },
  crimeBadgeTextDanger: { color: '#fff' },
});

export default EstadisticasScreen;