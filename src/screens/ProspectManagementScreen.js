import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Platform, TextInput, Alert, Modal,
  FlatList, Dimensions,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../theme/colors';

const { width: SW } = Dimensions.get('window');

// ─── Mock State ────────────────────────────────────────────────────────────────
const INITIAL_TARGET = {
  name: 'Mdrt2022',
  premiumTarget: 4000000,
  businessDone: 0,
  premiumFollowUp: 0,
  perDayRequired: 1,
  remainingDays: 0,
};

const TAB_ROWS = [
  ['Prospect Entry', 'Active Business', 'Target Entry'],
  ['Reminder', 'Activity Report', 'Daily Report'],
];

const GREETING_TABS = ['Belated', "Today's\nGreetings", 'Upcoming'];

// ─── Progress Bar ───────────────────────────────────────────────────────────────
const ProgressBar = ({ value, max, color = Colors.primary }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <View style={styles.progressWrap}>
      <View style={[styles.progressTrack]}>
        <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
};

// ─── Stat Box ───────────────────────────────────────────────────────────────────
const StatBox = ({ label1, label2, value, color = '#2196F3' }) => (
  <View style={styles.statBox}>
    <Text style={styles.statLabel}>{label1}</Text>
    {label2 ? <Text style={styles.statLabel}>{label2}</Text> : null}
    <Text style={[styles.statValue, { color }]}>{value}</Text>
  </View>
);

// ─── Prospect Entry Modal ───────────────────────────────────────────────────────
const ProspectEntryModal = ({ visible, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [policy, setPolicy] = useState('');
  const [premium, setPremium] = useState('');
  const [date, setDate] = useState('');

  const handleSave = () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('Error', 'Name and Phone are required.');
      return;
    }
    onSave({ name, phone, policy, premium, date, id: Date.now().toString() });
    setName(''); setPhone(''); setPolicy(''); setPremium(''); setDate('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Prospect Entry</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={22} color={Colors.textGray} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 8 }}>
            <ModalInput label="Prospect Name *" value={name} onChangeText={setName} placeholder="Enter full name" />
            <ModalInput label="Phone Number *" value={phone} onChangeText={setPhone} placeholder="10-digit mobile" keyboardType="phone-pad" />
            <ModalInput label="Policy / Plan" value={policy} onChangeText={setPolicy} placeholder="e.g. Jeevan Anand" />
            <ModalInput label="Premium Amount (₹)" value={premium} onChangeText={setPremium} placeholder="e.g. 25000" keyboardType="numeric" />
            <ModalInput label="Follow-up Date (DD/MM/YYYY)" value={date} onChangeText={setDate} placeholder="e.g. 20/06/2026" />
          </ScrollView>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>Save Prospect</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ─── Target Entry Modal ─────────────────────────────────────────────────────────
const TargetEntryModal = ({ visible, onClose, onSave, current }) => {
  const [name, setName] = useState(current.name);
  const [target, setTarget] = useState(String(current.premiumTarget));
  const [days, setDays] = useState(String(current.remainingDays));

  const handleSave = () => {
    onSave({ name, premiumTarget: parseInt(target) || 0, remainingDays: parseInt(days) || 0 });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Target Entry</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={22} color={Colors.textGray} />
            </TouchableOpacity>
          </View>
          <View style={{ gap: 10 }}>
            <ModalInput label="Target Name" value={name} onChangeText={setName} placeholder="e.g. MDRT 2026" />
            <ModalInput label="Premium Target (₹)" value={target} onChangeText={setTarget} placeholder="e.g. 4000000" keyboardType="numeric" />
            <ModalInput label="Remaining Days" value={days} onChangeText={setDays} placeholder="e.g. 180" keyboardType="numeric" />
          </View>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>Save Target</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const ModalInput = ({ label, value, onChangeText, placeholder, keyboardType = 'default' }) => (
  <View>
    <Text style={styles.inputLabel}>{label}</Text>
    <TextInput
      style={styles.modalInput}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={Colors.textLight}
      keyboardType={keyboardType}
    />
  </View>
);

// ─── Prospect List Item ─────────────────────────────────────────────────────────
const ProspectItem = ({ item, onDelete }) => (
  <View style={styles.prospectItem}>
    <View style={styles.prospectAvatar}>
      <Text style={styles.prospectInitial}>{item.name[0]?.toUpperCase()}</Text>
    </View>
    <View style={styles.prospectInfo}>
      <Text style={styles.prospectName}>{item.name}</Text>
      <Text style={styles.prospectPhone}>{item.phone}</Text>
      {item.policy ? <Text style={styles.prospectPolicy}>{item.policy}</Text> : null}
      {item.date ? (
        <View style={styles.prospectDateRow}>
          <MaterialIcons name="calendar-today" size={12} color={Colors.textGray} />
          <Text style={styles.prospectDate}>Follow-up: {item.date}</Text>
        </View>
      ) : null}
    </View>
    {item.premium ? (
      <Text style={styles.prospectPremium}>₹{parseInt(item.premium).toLocaleString()}</Text>
    ) : null}
    <TouchableOpacity onPress={() => onDelete(item.id)} style={{ padding: 4 }}>
      <MaterialIcons name="delete-outline" size={20} color="#E74C3C" />
    </TouchableOpacity>
  </View>
);

// ─── Main Screen ────────────────────────────────────────────────────────────────
const ProspectManagementScreen = ({ navigation }) => {
  const [target, setTarget] = useState(INITIAL_TARGET);
  const [activeTab, setActiveTab] = useState('Reminder');
  const [greetingTab, setGreetingTab] = useState("Today's\nGreetings");
  const [prospects, setProspects] = useState([]);
  const [showProspectModal, setShowProspectModal] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [activeView, setActiveView] = useState('reminder'); // reminder | prospects | active | report

  const handleTabPress = (tab) => {
    setActiveTab(tab);
    if (tab === 'Prospect Entry') { setShowProspectModal(true); return; }
    if (tab === 'Target Entry') { setShowTargetModal(true); return; }
    if (tab === 'Active Business') setActiveView('active');
    if (tab === 'Activity Report') setActiveView('report');
    if (tab === 'Daily Report') setActiveView('daily');
    if (tab === 'Reminder') setActiveView('reminder');
  };

  const handleSaveProspect = (p) => {
    setProspects(prev => [p, ...prev]);
    setActiveView('prospects');
  };

  const handleSaveTarget = (t) => {
    setTarget(prev => ({ ...prev, ...t }));
  };

  const deleteProspect = (id) => {
    Alert.alert('Delete', 'Remove this prospect?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => setProspects(p => p.filter(x => x.id !== id)) },
    ]);
  };

  const pct = target.premiumTarget > 0
    ? Math.round((target.businessDone / target.premiumTarget) * 100)
    : 0;

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor="#1565C0" barStyle="light-content" />

      {/* Header — blue like screenshot */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Prospect Management</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* ── Target Card ── */}
        <View style={styles.targetCard}>
          <View style={styles.targetTopRow}>
            <Text style={styles.targetName}>{target.name}</Text>
            <Text style={styles.remainingDays}>Remaining Days :- {target.remainingDays}</Text>
          </View>
          <Text style={styles.premiumTargetLabel}>
            Premium Target : {target.premiumTarget.toLocaleString()}
          </Text>

          {/* Business Done */}
          <View style={styles.progressRow}>
            <View style={styles.checkCircle}>
              <MaterialIcons name="check" size={16} color="#fff" />
            </View>
            <View style={styles.progressSection}>
              <Text style={styles.progressLabel}>
                Business Done :- {target.businessDone}/{target.premiumTarget.toLocaleString()}
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, {
                  width: target.premiumTarget > 0
                    ? `${Math.min((target.businessDone / target.premiumTarget) * 100, 100)}%`
                    : '0%',
                  backgroundColor: '#E74C3C',
                }]} />
              </View>
            </View>
          </View>

          {/* Premium FollowUp */}
          <View style={styles.progressRow}>
            <View style={styles.checkCircle}>
              <MaterialIcons name="check" size={16} color="#fff" />
            </View>
            <View style={styles.progressSection}>
              <Text style={styles.progressLabel}>
                Premium FollowUp :- {target.premiumFollowUp}
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, {
                  width: '0%', backgroundColor: '#E74C3C',
                }]} />
              </View>
            </View>
          </View>

          <Text style={styles.perDayLabel}>
            Per Day Required Premium : {target.perDayRequired}
          </Text>
        </View>

        {/* ── Stats Row ── */}
        <View style={styles.statsRow}>
          <StatBox label1="Active" label2="Reminder" value={prospects.length} />
          <View style={styles.statDivider} />
          <StatBox label1="Active" label2="Business" value={0} />
          <View style={styles.statDivider} />
          <StatBox label1="Total" label2="Prospect" value={prospects.length} />
        </View>

        {/* ── Action Tabs Row 1 ── */}
        <View style={styles.tabRow}>
          {TAB_ROWS[0].map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
              onPress={() => handleTabPress(tab)}
            >
              <Text style={[styles.tabBtnText, activeTab === tab && styles.tabBtnTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Action Tabs Row 2 ── */}
        <View style={styles.tabRow}>
          {TAB_ROWS[1].map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
              onPress={() => handleTabPress(tab)}
            >
              <Text style={[styles.tabBtnText, activeTab === tab && styles.tabBtnTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Greeting Tabs (only for Reminder view) ── */}
        {activeView === 'reminder' && (
          <>
            <View style={styles.greetingTabRow}>
              {GREETING_TABS.map(tab => (
                <TouchableOpacity
                  key={tab}
                  style={styles.greetingTab}
                  onPress={() => setGreetingTab(tab)}
                >
                  <Text style={[styles.greetingTabText, greetingTab === tab && styles.greetingTabTextActive]}>
                    {tab}
                  </Text>
                  {greetingTab === tab && <View style={styles.greetingUnderline} />}
                </TouchableOpacity>
              ))}
            </View>

            {/* Empty state */}
            <View style={styles.emptyWrap}>
              <MaterialIcons name="warning-amber" size={64} color="#555" />
              <Text style={styles.emptyText}>No Reminders Found</Text>
            </View>
          </>
        )}

        {/* ── Prospect List ── */}
        {activeView === 'prospects' && (
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>All Prospects ({prospects.length})</Text>
              <TouchableOpacity onPress={() => setShowProspectModal(true)} style={styles.addBtn}>
                <MaterialIcons name="add" size={18} color="#fff" />
                <Text style={styles.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
            {prospects.length === 0 ? (
              <View style={styles.emptyWrap}>
                <MaterialIcons name="people-outline" size={56} color={Colors.border} />
                <Text style={styles.emptyText}>No prospects yet</Text>
              </View>
            ) : (
              prospects.map(p => (
                <ProspectItem key={p.id} item={p} onDelete={deleteProspect} />
              ))
            )}
          </View>
        )}

        {/* ── Active Business ── */}
        {activeView === 'active' && (
          <View style={styles.emptyWrap}>
            <MaterialIcons name="business-center" size={56} color={Colors.border} />
            <Text style={styles.emptyText}>No Active Business</Text>
          </View>
        )}

        {/* ── Reports ── */}
        {(activeView === 'report' || activeView === 'daily') && (
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>
              {activeView === 'report' ? 'Activity Report' : 'Daily Report'}
            </Text>
            <View style={styles.reportCard}>
              <ReportRow label="Total Prospects" value={prospects.length} />
              <ReportRow label="Business Done" value={`₹${target.businessDone.toLocaleString()}`} />
              <ReportRow label="Target" value={`₹${target.premiumTarget.toLocaleString()}`} />
              <ReportRow label="Achievement" value={`${pct}%`} highlight />
              <ReportRow label="Remaining Days" value={target.remainingDays} />
              <ReportRow label="Per Day Required" value={`₹${target.perDayRequired.toLocaleString()}`} />
            </View>
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowProspectModal(true)}
      >
        <MaterialIcons name="person-add" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Modals */}
      <ProspectEntryModal
        visible={showProspectModal}
        onClose={() => setShowProspectModal(false)}
        onSave={handleSaveProspect}
      />
      <TargetEntryModal
        visible={showTargetModal}
        onClose={() => setShowTargetModal(false)}
        onSave={handleSaveTarget}
        current={target}
      />
    </View>
  );
};

const ReportRow = ({ label, value, highlight }) => (
  <View style={styles.reportRow}>
    <Text style={styles.reportLabel}>{label}</Text>
    <Text style={[styles.reportValue, highlight && { color: Colors.primary, fontWeight: '800' }]}>
      {value}
    </Text>
  </View>
);

// ─── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F2F5' },

  header: {
    backgroundColor: '#1565C0',
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 6 : 10,
    elevation: 4,
  },
  backBtn: { padding: 6 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '700', marginLeft: 8 },

  content: { padding: 12 },

  // Target Card
  targetCard: {
    backgroundColor: '#fff', borderRadius: 12,
    padding: 14, marginBottom: 10,
    elevation: 2,
  },
  targetTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  targetName: { fontSize: 15, fontWeight: '700', color: Colors.textDark },
  remainingDays: { fontSize: 12, color: Colors.textGray },
  premiumTargetLabel: { fontSize: 12, color: Colors.textGray, marginBottom: 10 },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  checkCircle: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#333',
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  progressSection: { flex: 1 },
  progressLabel: { fontSize: 13, fontWeight: '600', color: Colors.textDark, marginBottom: 5 },
  progressTrack: {
    height: 14, backgroundColor: '#E0E0E0',
    borderRadius: 7, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 7, minWidth: 14 },
  progressWrap: { marginVertical: 4 },
  perDayLabel: { fontSize: 12, color: Colors.textGray, marginTop: 2 },

  // Stats
  statsRow: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderRadius: 12, marginBottom: 10,
    elevation: 1, paddingVertical: 14,
  },
  statBox: { flex: 1, alignItems: 'center', gap: 2 },
  statLabel: { fontSize: 12, color: Colors.textGray, textAlign: 'center' },
  statValue: { fontSize: 22, fontWeight: '800' },
  statDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },

  // Tabs
  tabRow: {
    flexDirection: 'row', gap: 8,
    marginBottom: 8,
  },
  tabBtn: {
    flex: 1, paddingVertical: 9,
    borderRadius: 8, borderWidth: 1,
    borderColor: '#CCC', alignItems: 'center',
    backgroundColor: '#fff',
  },
  tabBtnActive: { backgroundColor: '#1565C0', borderColor: '#1565C0' },
  tabBtnText: { fontSize: 12, color: Colors.textDark, fontWeight: '500', textAlign: 'center' },
  tabBtnTextActive: { color: '#fff', fontWeight: '700' },

  // Greeting tabs
  greetingTabRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 10, marginBottom: 10,
    overflow: 'hidden',
  },
  greetingTab: { flex: 1, alignItems: 'center', paddingVertical: 12, position: 'relative' },
  greetingTabText: { fontSize: 13, color: Colors.textGray, textAlign: 'center', lineHeight: 18 },
  greetingTabTextActive: { color: Colors.textDark, fontWeight: '700' },
  greetingUnderline: {
    position: 'absolute', bottom: 0, left: '15%', right: '15%',
    height: 2.5, backgroundColor: '#E74C3C', borderRadius: 2,
  },

  // Empty
  emptyWrap: {
    alignItems: 'center', paddingVertical: 48, gap: 10,
    backgroundColor: '#fff', borderRadius: 12,
  },
  emptyText: { fontSize: 14, color: Colors.textGray, fontWeight: '500' },

  // Section
  sectionWrap: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', marginBottom: 10 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.textDark },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  // Prospect item
  prospectItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  prospectAvatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center', alignItems: 'center',
  },
  prospectInitial: { fontSize: 18, fontWeight: '800', color: Colors.primary },
  prospectInfo: { flex: 1 },
  prospectName: { fontSize: 14, fontWeight: '700', color: Colors.textDark },
  prospectPhone: { fontSize: 12, color: Colors.textGray },
  prospectPolicy: { fontSize: 11, color: '#2980B9', marginTop: 1 },
  prospectDateRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  prospectDate: { fontSize: 11, color: Colors.textGray },
  prospectPremium: { fontSize: 13, fontWeight: '700', color: '#27AE60' },

  // Report
  reportCard: { padding: 14, gap: 10 },
  reportRow: { flexDirection: 'row', justifyContent: 'space-between' },
  reportLabel: { fontSize: 13, color: Colors.textGray },
  reportValue: { fontSize: 13, fontWeight: '600', color: Colors.textDark },

  // FAB
  fab: {
    position: 'absolute', bottom: 20, right: 20,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#1565C0',
    justifyContent: 'center', alignItems: 'center',
    elevation: 8,
  },

  // Modals
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff', borderTopLeftRadius: 20,
    borderTopRightRadius: 20, padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: Colors.textDark },
  inputLabel: { fontSize: 12, color: Colors.textGray, marginBottom: 4, fontWeight: '500' },
  modalInput: {
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 14, color: Colors.textDark, backgroundColor: '#FAFAFA',
  },
  saveBtn: {
    backgroundColor: '#1565C0', borderRadius: 10,
    paddingVertical: 13, alignItems: 'center', marginTop: 16,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

export default ProspectManagementScreen;