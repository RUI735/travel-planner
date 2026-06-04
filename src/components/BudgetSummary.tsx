// src/components/BudgetSummary.tsx
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Day } from '../types/trip';
import { aggregateBudgets } from '../services/budget';

// Android 需要手动启用 LayoutAnimation
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  days: Day[];
  partySize: number;
}

function formatCNY(amount: number): string {
  return `¥${amount.toLocaleString('zh-CN')}`;
}

export default function BudgetSummary({ days, partySize }: Props) {
  const [expanded, setExpanded] = useState(false);

  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  }, []);

  const totals = aggregateBudgets(days);

  // 没有任何预算数据，不渲染
  if (!totals || totals.perPersonCost === 0) return null;

  const safePartySize = partySize > 0 ? partySize : 1;
  const totalCost = totals.perPersonCost * safePartySize;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={toggle}
      activeOpacity={0.85}
    >
      {/* 折叠状态下的概览行 */}
      <View style={styles.summaryRow}>
        <Text style={styles.summaryText}>
          💰 人均约 {formatCNY(totals.perPersonCost)} · 总计约{' '}
          {formatCNY(totalCost)}
        </Text>
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </View>

      {/* 展开后的分项明细 */}
      {expanded && (
        <View style={styles.detailSection}>
          <View style={styles.divider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>🎫 门票</Text>
            <Text style={styles.detailValue}>
              {formatCNY(totals.ticketCost)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>🚗 交通</Text>
            <Text style={styles.detailValue}>
              {formatCNY(totals.transportCost)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>🍜 餐饮</Text>
            <Text style={styles.detailValue}>
              {formatCNY(totals.diningCost)}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.detailRow}>
            <Text style={styles.totalLabel}>人均合计</Text>
            <Text style={styles.totalValue}>
              {formatCNY(totals.perPersonCost)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.totalLabel}>
              总计（{safePartySize}人）
            </Text>
            <Text style={styles.totalValue}>{formatCNY(totalCost)}</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5D4E37',
    flex: 1,
  },
  chevron: {
    fontSize: 12,
    color: '#A68A3C',
    marginLeft: 8,
  },
  detailSection: {
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#E8D5A3',
    marginVertical: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 13,
    color: '#6B5E4A',
  },
  detailValue: {
    fontSize: 13,
    color: '#5D4E37',
    fontWeight: '500',
  },
  totalLabel: {
    fontSize: 14,
    color: '#5D4E37',
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 14,
    color: '#C77D20',
    fontWeight: '700',
  },
});
