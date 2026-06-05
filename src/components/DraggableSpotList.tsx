// DraggableSpotList — drag-to-reorder with per-item PanResponder handles
// Works in Expo Go with zero native dependencies beyond react-native
import React, { useRef, useState, useCallback, useMemo } from 'react';
import { View, Animated, PanResponder, StyleSheet, LayoutChangeEvent } from 'react-native';

interface SpotLike {
  id: string;
  order: number;
}

interface Props<T extends SpotLike> {
  items: T[];
  onReorder: (ids: string[]) => void;
  onDragActive?: (active: boolean) => void;
  renderItem: (
    item: T,
    index: number,
    isDragging: boolean,
    dragHandlers: { onLongPress: () => void; panHandlers: any }
  ) => React.ReactNode;
}

export default function DraggableSpotList<T extends SpotLike>({
  items,
  onReorder,
  onDragActive,
  renderItem,
}: Props<T>) {
  const [dragging, setDragging] = useState(-1);
  const [order, setOrder] = useState<string[]>([]);
  const dragY = useRef(new Animated.Value(0)).current;
  const layouts = useRef<{ y: number; h: number }[]>([]);
  const hasMoved = useRef(false);

  const draggingRef = useRef(-1);
  const orderRef = useRef<string[]>([]);
  const onDragActiveRef = useRef(onDragActive);
  draggingRef.current = dragging;
  onDragActiveRef.current = onDragActive;

  const currentOrder = order.length === items.length ? order : items.map((it) => it.id);
  orderRef.current = currentOrder;

  const orderedItems = useMemo(() => {
    const map = new Map(items.map((it) => [it.id, it]));
    return currentOrder.map((id) => map.get(id)!);
  }, [items, currentOrder]);

  const commitReorder = useCallback(() => {
    const finalOrder = orderRef.current;
    if (finalOrder.length === items.length) {
      onReorder(finalOrder);
    }
    // Reset
    Animated.spring(dragY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 200,
      friction: 20,
    }).start(() => {
      setDragging(-1);
      setOrder([]);
      dragY.setValue(0);
      hasMoved.current = false;
      onDragActiveRef.current?.(false);
    });
  }, [dragY, items.length, onReorder]);

  const createItemPanResponder = useCallback(
    (idx: number) => {
      let longPressTimer: ReturnType<typeof setTimeout> | null = null;
      let active = false;

      return PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => active,

        onPanResponderGrant: () => {
          hasMoved.current = false;
          // Start long press timer
          longPressTimer = setTimeout(() => {
            active = true;
            setDragging(idx);
            onDragActiveRef.current?.(true);
            dragY.setValue(0);

            if (order.length === 0) {
              const ids = items.map((it) => it.id);
              setOrder(ids);
              orderRef.current = ids;
            }
          }, 200);
        },

        onPanResponderMove: (_, gs) => {
          if (!active) {
            // If moved before long press, cancel timer
            if (Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5) {
              if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
              }
            }
            return;
          }

          hasMoved.current = true;
          dragY.setValue(gs.dy);

          const i = draggingRef.current;
          if (i < 0 || i >= layouts.current.length) return;
          const layout = layouts.current[i];
          if (!layout) return;

          const draggedMid = layout.y + gs.dy + layout.h / 2;
          const ids = [...orderRef.current];

          let target = i;
          for (let j = 0; j < layouts.current.length; j++) {
            if (j === i) continue;
            const l = layouts.current[j];
            if (!l) continue;
            const mid = l.y + l.h / 2;
            if (i < j && draggedMid > mid) target = j;
            else if (i > j && draggedMid < mid) target = j;
          }

          if (target !== i) {
            const newOrder = [...ids];
            const [moved] = newOrder.splice(i, 1);
            newOrder.splice(target, 0, moved);
            orderRef.current = newOrder;
            setOrder(newOrder);
            setDragging(target);
            dragY.setValue(0);
          }
        },

        onPanResponderRelease: () => {
          if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
          }
          if (active) {
            commitReorder();
          }
          active = false;
        },

        onPanResponderTerminate: () => {
          if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
          }
          if (active) {
            dragY.setValue(0);
            setDragging(-1);
            setOrder([]);
            onDragActiveRef.current?.(false);
          }
          active = false;
        },
      });
    },
    [items, order.length, dragY, commitReorder]
  );

  // Cache PanResponders per index
  const respondersRef = useRef<Map<number, ReturnType<typeof PanResponder.create>>>(new Map());
  if (respondersRef.current.size > items.length + 5) {
    respondersRef.current.clear();
  }

  const getResponder = useCallback(
    (idx: number) => {
      if (!respondersRef.current.has(idx)) {
        respondersRef.current.set(idx, createItemPanResponder(idx));
      }
      return respondersRef.current.get(idx)!;
    },
    [createItemPanResponder]
  );

  return (
    <View style={styles.container}>
      {orderedItems.map((item, idx) => {
        const isDragging = dragging === idx;
        const responder = getResponder(idx);
        const panHandlers = responder.panHandlers;

        return (
          <Animated.View
            key={item.id}
            onLayout={(e: LayoutChangeEvent) => {
              layouts.current[idx] = {
                y: e.nativeEvent.layout.y,
                h: e.nativeEvent.layout.height,
              };
            }}
            style={[
              isDragging && {
                transform: [{ translateY: dragY }],
                zIndex: 999,
                elevation: 8,
                opacity: 0.92,
              },
            ]}
          >
            {renderItem(item, idx, isDragging, {
              onLongPress: () => {}, // handled by PanResponder internally
              panHandlers,
            })}
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
});
