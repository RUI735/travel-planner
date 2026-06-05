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
import { Colors, FontSize, Radius, Shadow, Spacing } from '../theme';

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
    backgroundColor: Colors.budgetBg,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    ...Shadow.card,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.budgetText,
    flex: 1,
  },
  chevron: {
    fontSize: FontSize.xs,
    color: Colors.budgetAccent,
    marginLeft: Spacing.sm,
  },
  detailSection: {
    marginTop: Spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.warning,
    marginVertical: Spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  detailLabel: {
    fontSize: FontSize.sm,
    color: Colors.budgetText,
  },
  detailValue: {
    fontSize: FontSize.sm,
    color: Colors.budgetText,
    fontWeight: '500',
  },
  totalLabel: {
    fontSize: FontSize.sm,
    color: Colors.budgetText,
    fontWeight: '600',
  },
  totalValue: {
    fontSize: FontSize.sm,
    color: Colors.budgetAccent,
    fontWeight: '700',
  },
});
