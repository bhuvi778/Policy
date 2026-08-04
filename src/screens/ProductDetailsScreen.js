import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, Platform, Alert,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';

const PRODUCTS = [
  {
    id: '1', category: 'Life Insurance',
    icon: 'shield-account', color: '#C0392B',
    items: [
      { id: '1a', name: 'Jeevan Anand', type: 'Endowment', minAge: '18', maxAge: '50', term: '15-35 yrs', benefit: 'Death + Maturity' },
      { id: '1b', name: 'Jeevan Umang', type: 'Whole Life', minAge: '90 days', maxAge: '55', term: 'Till 100 yrs', benefit: 'Survival + Death' },
      { id: '1c', name: 'Tech Term', type: 'Term Plan', minAge: '18', maxAge: '65', term: '10-40 yrs', benefit: 'Pure Death Cover' },
      { id: '1d', name: 'Jeevan Labh', type: 'Endowment', minAge: '8', maxAge: '59', term: '16-25 yrs', benefit: 'Death + Maturity' },
    ],
  },
  {
    id: '2', category: 'Health Insurance',
    icon: 'hospital-box', color: '#27AE60',
    items: [
      { id: '2a', name: 'Cancer Cover', type: 'Critical Illness', minAge: '20', maxAge: '65', term: '1 yr renewable', benefit: 'Lump Sum on Diagnosis' },
      { id: '2b', name: 'Arogya Rakshak', type: 'Health Plan', minAge: '91 days', maxAge: '65', term: '1 yr renewable', benefit: 'Hospitalization Cover' },
    ],
  },
  {
    id: '3', category: 'Investment Plans',
    icon: 'chart-line', color: '#2980B9',
    items: [
      { id: '3a', name: 'Jeevan Lakshya', type: 'Endowment', minAge: '18', maxAge: '50', term: '13-25 yrs', benefit: 'Annual Income + Maturity' },
      { id: '3b', name: 'Money Back', type: 'Money Back', minAge: '13', maxAge: '50', term: '20-25 yrs', benefit: 'Periodic Returns' },
      { id: '3c', name: 'SIIP', type: 'ULIP', minAge: '0', maxAge: '65', term: '5-30 yrs', benefit: 'Market Linked Returns' },
    ],
  },
  {
    id: '4', category: 'Pension Plans',
    icon: 'account-clock', color: '#8E44AD',
    items: [
      { id: '4a', name: 'Jeevan Shanti', type: 'Annuity', minAge: '30', maxAge: '79', term: 'Immediate/Deferred', benefit: 'Regular Pension Income' },
      { id: '4b', name: 'New Jeevan Nidhi', type: 'Pension', minAge: '20', maxAge: '60', term: 'Till Vesting Age', benefit: 'Pension + Death Cover' },
    ],
  },
  {
    id: '5', category: 'Child Plans',
    icon: 'baby-face', color: '#E67E22',
    items: [
      { id: '5a', name: 'Jeevan Tarun', type: 'Child Plan', minAge: '91 days', maxAge: '12', term: 'Till age 25', benefit: 'Education + Maturity' },
      { id: '5b', name: 'Child Future Plan', type: 'Endowment', minAge: '0', maxAge: '10', term: '15-25 yrs', benefit: 'Future Security' },
    ],
  },
];

const ProductCard = ({ item, color }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <TouchableOpacity
      style={styles.productCard}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.85}
    >
      <View style={styles.productHeader}>
        <View style={[styles.productDot, { backgroundColor: color }]} />
        <Text style={styles.productName}>{item.name}</Text>
        <View style={[styles.typeBadge, { backgroundColor: color + '20' }]}>
          <Text style={[styles.typeText, { color }]}>{item.type}</Text>
        </View>
        <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={20} color={Colors.textGray} />
      </View>
      {expanded && (
        <View style={styles.productDetails}>
          <DetailRow label="Min Age" value={item.minAge} />
          <DetailRow label="Max Age" value={item.maxAge} />
          <DetailRow label="Policy Term" value={item.term} />
          <DetailRow label="Key Benefit" value={item.benefit} />
          <TouchableOpacity
            style={[styles.knowMoreBtn, { backgroundColor: color }]}
            onPress={() => Alert.alert(item.name, `${item.benefit}\n\nFor more details, contact your LIC advisor.`)}
          >
            <Text style={styles.knowMoreText}>Know More</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
};

const DetailRow = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const CategorySection = ({ item }) => (
  <View style={styles.categorySection}>
    <View style={[styles.categoryHeader, { backgroundColor: item.color + '15' }]}>
      <MaterialCommunityIcons name={item.icon} size={22} color={item.color} />
      <Text style={[styles.categoryTitle, { color: item.color }]}>{item.category}</Text>
      <View style={[styles.countBadge, { backgroundColor: item.color }]}>
        <Text style={styles.countText}>{item.items.length}</Text>
      </View>
    </View>
    {item.items.map(p => (
      <ProductCard key={p.id} item={p} color={item.color} />
    ))}
  </View>
);

const ProductDetailsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  return (
  <View style={styles.root}>
    <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
    <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <MaterialIcons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Product Details</Text>
      <View style={{ width: 36 }} />
    </View>

    <FlatList
      data={PRODUCTS}
      keyExtractor={item => item.id}
      renderItem={({ item }) => <CategorySection item={item} />}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 6 : 10,
    elevation: 4,
  },
  backBtn: { padding: 6 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '700', marginLeft: 8 },
  listContent: { padding: 14, paddingBottom: 30 },
  categorySection: { marginBottom: 16 },
  categoryHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 10, marginBottom: 6,
  },
  categoryTitle: { flex: 1, fontSize: 15, fontWeight: '700' },
  countBadge: {
    width: 24, height: 24, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  countText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  productCard: {
    backgroundColor: '#fff', borderRadius: 10,
    marginBottom: 6, elevation: 1, overflow: 'hidden',
  },
  productHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12, gap: 8,
  },
  productDot: { width: 8, height: 8, borderRadius: 4 },
  productName: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.textDark },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeText: { fontSize: 11, fontWeight: '600' },
  productDetails: {
    paddingHorizontal: 14, paddingBottom: 12,
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
    paddingTop: 10, gap: 6,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { fontSize: 12, color: Colors.textGray },
  detailValue: { fontSize: 12, fontWeight: '600', color: Colors.textDark },
  knowMoreBtn: {
    marginTop: 8, borderRadius: 8,
    paddingVertical: 8, alignItems: 'center',
  },
  knowMoreText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});

export default ProductDetailsScreen;