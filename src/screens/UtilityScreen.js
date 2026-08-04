import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Platform, TextInput, Alert,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';

// ── EMI Calculator ─────────────────────────────────────────────────────────────
const EMICalculator = () => {
  const [principal, setPrincipal] = useState('');
  const [rate, setRate] = useState('');
  const [tenure, setTenure] = useState('');
  const [result, setResult] = useState(null);

  const calculate = () => {
    const P = parseFloat(principal);
    const r = parseFloat(rate) / 12 / 100;
    const n = parseInt(tenure);
    if (!P || !r || !n) { Alert.alert('Error', 'Please fill all fields'); return; }
    const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const total = emi * n;
    setResult({ emi: emi.toFixed(0), total: total.toFixed(0), interest: (total - P).toFixed(0) });
  };

  return (
    <View style={styles.toolCard}>
      <View style={styles.toolHeader}>
        <MaterialCommunityIcons name="calculator" size={22} color={Colors.primary} />
        <Text style={styles.toolTitle}>EMI Calculator</Text>
      </View>
      <ToolInput label="Loan Amount (₹)" value={principal} onChangeText={setPrincipal} placeholder="e.g. 500000" />
      <ToolInput label="Annual Interest Rate (%)" value={rate} onChangeText={setRate} placeholder="e.g. 8.5" />
      <ToolInput label="Tenure (months)" value={tenure} onChangeText={setTenure} placeholder="e.g. 60" />
      <TouchableOpacity style={styles.calcBtn} onPress={calculate}>
        <Text style={styles.calcBtnText}>Calculate EMI</Text>
      </TouchableOpacity>
      {result && (
        <View style={styles.resultBox}>
          <ResultRow label="Monthly EMI" value={`₹ ${parseInt(result.emi).toLocaleString()}`} highlight />
          <ResultRow label="Total Payment" value={`₹ ${parseInt(result.total).toLocaleString()}`} />
          <ResultRow label="Total Interest" value={`₹ ${parseInt(result.interest).toLocaleString()}`} />
        </View>
      )}
    </View>
  );
};

// ── Premium Calculator ──────────────────────────────────────────────────────────
const PremiumCalc = () => {
  const [sumAssured, setSumAssured] = useState('');
  const [age, setAge] = useState('');
  const [term, setTerm] = useState('');
  const [result, setResult] = useState(null);

  const calculate = () => {
    const sa = parseFloat(sumAssured);
    const a = parseInt(age);
    const t = parseInt(term);
    if (!sa || !a || !t) { Alert.alert('Error', 'Please fill all fields'); return; }
    // Simplified premium calculation (indicative only)
    const baseRate = 0.006 + (a / 1000) + (1 / t / 10);
    const annual = sa * baseRate;
    const monthly = annual / 12;
    const quarterly = annual / 4;
    setResult({
      annual: annual.toFixed(0),
      monthly: monthly.toFixed(0),
      quarterly: quarterly.toFixed(0),
    });
  };

  return (
    <View style={styles.toolCard}>
      <View style={styles.toolHeader}>
        <MaterialCommunityIcons name="shield-check" size={22} color="#2980B9" />
        <Text style={styles.toolTitle}>Premium Estimator</Text>
      </View>
      <Text style={styles.toolNote}>* Indicative values only. Actual premium may vary.</Text>
      <ToolInput label="Sum Assured (₹)" value={sumAssured} onChangeText={setSumAssured} placeholder="e.g. 1000000" />
      <ToolInput label="Age (years)" value={age} onChangeText={setAge} placeholder="e.g. 30" />
      <ToolInput label="Policy Term (years)" value={term} onChangeText={setTerm} placeholder="e.g. 20" />
      <TouchableOpacity style={[styles.calcBtn, { backgroundColor: '#2980B9' }]} onPress={calculate}>
        <Text style={styles.calcBtnText}>Estimate Premium</Text>
      </TouchableOpacity>
      {result && (
        <View style={styles.resultBox}>
          <ResultRow label="Annual Premium" value={`₹ ${parseInt(result.annual).toLocaleString()}`} highlight />
          <ResultRow label="Monthly Premium" value={`₹ ${parseInt(result.monthly).toLocaleString()}`} />
          <ResultRow label="Quarterly Premium" value={`₹ ${parseInt(result.quarterly).toLocaleString()}`} />
        </View>
      )}
    </View>
  );
};

// ── BMI Calculator ──────────────────────────────────────────────────────────────
const BMICalc = () => {
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [result, setResult] = useState(null);

  const calculate = () => {
    const w = parseFloat(weight);
    const h = parseFloat(height) / 100;
    if (!w || !h) { Alert.alert('Error', 'Please fill all fields'); return; }
    const bmi = w / (h * h);
    let category = '';
    let color = '';
    if (bmi < 18.5) { category = 'Underweight'; color = '#2980B9'; }
    else if (bmi < 25) { category = 'Normal'; color = '#27AE60'; }
    else if (bmi < 30) { category = 'Overweight'; color = '#E67E22'; }
    else { category = 'Obese'; color = '#E74C3C'; }
    setResult({ bmi: bmi.toFixed(1), category, color });
  };

  return (
    <View style={styles.toolCard}>
      <View style={styles.toolHeader}>
        <MaterialIcons name="fitness-center" size={22} color="#27AE60" />
        <Text style={styles.toolTitle}>BMI Calculator</Text>
      </View>
      <ToolInput label="Weight (kg)" value={weight} onChangeText={setWeight} placeholder="e.g. 70" />
      <ToolInput label="Height (cm)" value={height} onChangeText={setHeight} placeholder="e.g. 170" />
      <TouchableOpacity style={[styles.calcBtn, { backgroundColor: '#27AE60' }]} onPress={calculate}>
        <Text style={styles.calcBtnText}>Calculate BMI</Text>
      </TouchableOpacity>
      {result && (
        <View style={[styles.resultBox, { borderLeftColor: result.color }]}>
          <ResultRow label="Your BMI" value={result.bmi} highlight />
          <View style={styles.bmiCategoryRow}>
            <Text style={styles.bmiCategoryLabel}>Category: </Text>
            <Text style={[styles.bmiCategoryValue, { color: result.color }]}>{result.category}</Text>
          </View>
        </View>
      )}
    </View>
  );
};

// ── Age Calculator ──────────────────────────────────────────────────────────────
const AgeCalc = () => {
  const [dob, setDob] = useState('');
  const [result, setResult] = useState(null);

  const calculate = () => {
    const parts = dob.split('/');
    if (parts.length !== 3) { Alert.alert('Error', 'Enter date as DD/MM/YYYY'); return; }
    const birth = new Date(parts[2], parts[1] - 1, parts[0]);
    const today = new Date();
    if (isNaN(birth.getTime())) { Alert.alert('Error', 'Invalid date'); return; }
    let years = today.getFullYear() - birth.getFullYear();
    let months = today.getMonth() - birth.getMonth();
    let days = today.getDate() - birth.getDate();
    if (days < 0) { months--; days += new Date(today.getFullYear(), today.getMonth(), 0).getDate(); }
    if (months < 0) { years--; months += 12; }
    setResult({ years, months, days });
  };

  return (
    <View style={styles.toolCard}>
      <View style={styles.toolHeader}>
        <MaterialIcons name="cake" size={22} color="#8E44AD" />
        <Text style={styles.toolTitle}>Age Calculator</Text>
      </View>
      <ToolInput label="Date of Birth (DD/MM/YYYY)" value={dob} onChangeText={setDob} placeholder="e.g. 15/08/1990" />
      <TouchableOpacity style={[styles.calcBtn, { backgroundColor: '#8E44AD' }]} onPress={calculate}>
        <Text style={styles.calcBtnText}>Calculate Age</Text>
      </TouchableOpacity>
      {result && (
        <View style={[styles.resultBox, { borderLeftColor: '#8E44AD' }]}>
          <ResultRow label="Years" value={`${result.years} yrs`} highlight />
          <ResultRow label="Months" value={`${result.months} months`} />
          <ResultRow label="Days" value={`${result.days} days`} />
        </View>
      )}
    </View>
  );
};

// ── Shared components ───────────────────────────────────────────────────────────
const ToolInput = ({ label, value, onChangeText, placeholder }) => (
  <View style={styles.inputWrap}>
    <Text style={styles.inputLabel}>{label}</Text>
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={Colors.textLight}
      keyboardType="numeric"
    />
  </View>
);

const ResultRow = ({ label, value, highlight }) => (
  <View style={styles.resultRow}>
    <Text style={styles.resultLabel}>{label}</Text>
    <Text style={[styles.resultValue, highlight && styles.resultHighlight]}>{value}</Text>
  </View>
);

// ── Main Screen ─────────────────────────────────────────────────────────────────
const UtilityScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  return (
  <View style={styles.root}>
    <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
    <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <MaterialIcons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Utility Tools</Text>
      <View style={{ width: 36 }} />
    </View>

    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <EMICalculator />
      <PremiumCalc />
      <BMICalc />
      <AgeCalc />
    </ScrollView>
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
  content: { padding: 14, paddingBottom: 30, gap: 14 },
  toolCard: {
    backgroundColor: '#fff', borderRadius: 14,
    padding: 16, elevation: 2,
    borderTopWidth: 4, borderTopColor: Colors.primary,
  },
  toolHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  toolTitle: { fontSize: 16, fontWeight: '700', color: Colors.textDark },
  toolNote: { fontSize: 11, color: Colors.textGray, marginBottom: 10, fontStyle: 'italic' },
  inputWrap: { marginBottom: 10 },
  inputLabel: { fontSize: 12, color: Colors.textGray, marginBottom: 4, fontWeight: '500' },
  input: {
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 14, color: Colors.textDark, backgroundColor: '#FAFAFA',
  },
  calcBtn: {
    backgroundColor: Colors.primary, borderRadius: 10,
    paddingVertical: 12, alignItems: 'center', marginTop: 4,
  },
  calcBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  resultBox: {
    marginTop: 12, backgroundColor: '#FFF8F8',
    borderRadius: 10, padding: 12,
    borderLeftWidth: 4, borderLeftColor: Colors.primary,
    gap: 6,
  },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultLabel: { fontSize: 13, color: Colors.textGray },
  resultValue: { fontSize: 13, fontWeight: '600', color: Colors.textDark },
  resultHighlight: { fontSize: 18, fontWeight: '800', color: Colors.primary },
  bmiCategoryRow: { flexDirection: 'row', alignItems: 'center' },
  bmiCategoryLabel: { fontSize: 13, color: Colors.textGray },
  bmiCategoryValue: { fontSize: 14, fontWeight: '700' },
});

export default UtilityScreen;