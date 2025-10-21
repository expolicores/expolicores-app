import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  adminListB2BApplications,
  adminSetB2BAdminProcess,
  adminSetB2BVerification,
} from '../lib/api';
import { AdminProcessStatus, BusinessVerificationStatus } from '../types/b2b';

type Item = {
  id: number;
  name?: string;
  phone: string;
  email?: string | null;
  businessVerificationStatus: BusinessVerificationStatus;
  adminProcessStatus: AdminProcessStatus;
  role: 'ADMIN' | 'B2C' | 'B2B';
  createdAt?: string;
  updatedAt?: string;
};

const statusLabel: Record<AdminProcessStatus, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En proceso',
  ATTENDED: 'Atendida',
};

const statusColor: Record<AdminProcessStatus, string> = {
  PENDING: '#fee2e2',
  IN_PROGRESS: '#fef3c7',
  ATTENDED: '#dcfce7',
};

const verificationLabel: Record<BusinessVerificationStatus, string> = {
  NONE: 'Sin solicitud',
  SUBMITTED: 'En revisión',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
};

const filters = [
  { key: 'SUBMITTED', label: 'En revisión' },
  { key: 'APPROVED', label: 'Aprobadas' },
  { key: 'REJECTED', label: 'Rechazadas' },
  { key: 'SUBMITTED,APPROVED,REJECTED', label: 'Todo' },
];

export default function AdminBusinessApplicationsScreen() {
  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState(filters[3].key);
  const [loading, setLoading] = useState(false);
  const [mutating, setMutating] = useState<Record<number, 'admin' | 'verification'>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminListB2BApplications(filter);
      setItems(data);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No pudimos cargar las solicitudes.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdminProcess = useCallback(
    async (id: number, status: AdminProcessStatus) => {
      if (mutating[id]) return;
      setMutating((prev) => ({ ...prev, [id]: 'admin' }));
      try {
        await adminSetB2BAdminProcess(id, status);
        await load();
      } catch (e: any) {
        Alert.alert('Error', e?.message || 'No pudimos actualizar el estado interno.');
      } finally {
        setMutating((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    },
    [mutating, load],
  );

  const handleVerification = useCallback(
    async (id: number, status: 'APPROVED' | 'REJECTED') => {
      if (mutating[id]) return;
      setMutating((prev) => ({ ...prev, [id]: 'verification' }));
      try {
        await adminSetB2BVerification(id, status);
        await load();
      } catch (e: any) {
        Alert.alert('Error', e?.message || 'No pudimos actualizar la verificación.');
      } finally {
        setMutating((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    },
    [mutating, load],
  );

  const renderFilter = useCallback(
    ({ key, label }: typeof filters[number]) => {
      const active = filter === key;
      return (
        <TouchableOpacity
          key={key}
          onPress={() => setFilter(key)}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 14,
            borderRadius: 999,
            backgroundColor: active ? '#111827' : '#e5e7eb',
          }}
        >
          <Text style={{ color: active ? '#fff' : '#111827', fontWeight: '600' }}>{label}</Text>
        </TouchableOpacity>
      );
    },
    [filter],
  );

  const renderItem = ({ item }: { item: Item }) => {
    const itemMutating = !!mutating[item.id];
    let createdLabel: string | null = null;
    if (item.createdAt) {
      const date = new Date(item.createdAt);
      if (!Number.isNaN(date.valueOf())) {
        createdLabel = date.toLocaleString();
      }
    }

    const adminButtons = (['PENDING', 'IN_PROGRESS', 'ATTENDED'] as AdminProcessStatus[]).map((status) => {
      const active = item.adminProcessStatus === status;
      return (
        <TouchableOpacity
          key={status}
          disabled={itemMutating}
          onPress={() => handleAdminProcess(item.id, status)}
          style={{
            flex: 1,
            minWidth: 110,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 10,
            backgroundColor: active ? '#111827' : '#f3f4f6',
            opacity: itemMutating ? 0.6 : 1,
          }}
        >
          <Text style={{ color: active ? '#fff' : '#111827', textAlign: 'center', fontWeight: '600' }}>
            {statusLabel[status]}
          </Text>
        </TouchableOpacity>
      );
    });

    const verificationButtons = (
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <TouchableOpacity
          disabled={itemMutating}
          onPress={() => handleVerification(item.id, 'APPROVED')}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 10,
            backgroundColor: '#dcfce7',
            opacity: itemMutating ? 0.6 : 1,
          }}
        >
          <Text style={{ color: '#047857', textAlign: 'center', fontWeight: '700' }}>Aprobar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          disabled={itemMutating}
          onPress={() => handleVerification(item.id, 'REJECTED')}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 10,
            backgroundColor: '#fee2e2',
            opacity: itemMutating ? 0.6 : 1,
          }}
        >
          <Text style={{ color: '#b91c1c', textAlign: 'center', fontWeight: '700' }}>Rechazar</Text>
        </TouchableOpacity>
      </View>
    );

    return (
      <View
        style={{
          backgroundColor: '#fff',
          borderRadius: 16,
          padding: 16,
          marginBottom: 12,
          shadowColor: '#000',
          shadowOpacity: 0.05,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 3 },
          elevation: 2,
          gap: 10,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
          <Text style={{ fontWeight: '700', fontSize: 16 }}>{item.name || item.phone}</Text>
          {createdLabel ? <Text style={{ color: '#6b7280' }}>{createdLabel}</Text> : null}
        </View>
        <Text style={{ color: '#6b7280' }}>{item.phone} · {item.email ?? 'Sin correo'}</Text>

        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <View
            style={{
              backgroundColor: '#dbeafe',
              paddingVertical: 4,
              paddingHorizontal: 10,
              borderRadius: 999,
            }}
          >
            <Text style={{ color: '#1d4ed8', fontSize: 12, fontWeight: '700' }}>
              {verificationLabel[item.businessVerificationStatus]}
            </Text>
          </View>
          <View
            style={{
              backgroundColor: statusColor[item.adminProcessStatus],
              paddingVertical: 4,
              paddingHorizontal: 10,
              borderRadius: 999,
            }}
          >
            <Text style={{ color: '#111827', fontSize: 12, fontWeight: '700' }}>
              {statusLabel[item.adminProcessStatus]}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>{adminButtons}</View>

        <View style={{ height: 1, backgroundColor: '#e5e7eb' }} />

        {verificationButtons}

        {itemMutating && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 6 }}>
            <ActivityIndicator size="small" color="#111827" />
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: '#f3f4f6' }}>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {filters.map(renderFilter)}
          </View>
        }
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={
          !loading ? (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Text style={{ color: '#6b7280' }}>No hay solicitudes que coincidan con el filtro.</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}
