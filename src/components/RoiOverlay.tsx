import React, { useEffect, useRef } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import type { Roi } from '../types';

type Props = {
  roi: Roi;
  onChange: (roi: Roi) => void;
};

type Handle = 'move' | 'nw' | 'ne' | 'sw' | 'se';

export function RoiOverlay({ roi, onChange }: Props) {
  const layout = useRef({ width: 1, height: 1 });
  const startRoi = useRef(roi);
  const roiRef = useRef(roi);
  const onChangeRef = useRef(onChange);
  const handle = useRef<Handle>('move');

  useEffect(() => {
    roiRef.current = roi;
    onChangeRef.current = onChange;
  }, [roi, onChange]);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: event => {
        startRoi.current = roiRef.current;
        const { locationX, locationY } = event.nativeEvent;
        const box = pixelBox(
          roiRef.current,
          layout.current.width,
          layout.current.height,
        );
        handle.current = hitHandle(locationX, locationY, box);
      },
      onPanResponderMove: (_event, gesture) => {
        const next = resizeRoi(
          startRoi.current,
          handle.current,
          gesture.dx / layout.current.width,
          gesture.dy / layout.current.height,
        );
        onChangeRef.current(clampRoi(next));
      },
    }),
  ).current;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      onLayout={event => {
        layout.current = event.nativeEvent.layout;
      }}>
      <View
        {...responder.panHandlers}
        style={[
          styles.box,
          {
            left: `${roi.left * 100}%`,
            top: `${roi.top * 100}%`,
            width: `${(roi.right - roi.left) * 100}%`,
            height: `${(roi.bottom - roi.top) * 100}%`,
          },
        ]}>
        <View style={[styles.handle, styles.nw]} />
        <View style={[styles.handle, styles.ne]} />
        <View style={[styles.handle, styles.sw]} />
        <View style={[styles.handle, styles.se]} />
        <View style={styles.caption}>
          <Text style={styles.captionText}>ROI</Text>
        </View>
      </View>
    </View>
  );
}

function pixelBox(roi: Roi, width: number, height: number) {
  return {
    left: roi.left * width,
    top: roi.top * height,
    right: roi.right * width,
    bottom: roi.bottom * height,
  };
}

function hitHandle(
  x: number,
  y: number,
  box: { left: number; top: number; right: number; bottom: number },
): Handle {
  const slop = 28;
  const corners: Array<[Handle, number, number]> = [
    ['nw', box.left, box.top],
    ['ne', box.right, box.top],
    ['sw', box.left, box.bottom],
    ['se', box.right, box.bottom],
  ];
  for (const [name, cx, cy] of corners) {
    if (Math.abs(x - cx) <= slop && Math.abs(y - cy) <= slop) {
      return name;
    }
  }
  return 'move';
}

function resizeRoi(start: Roi, handle: Handle, dx: number, dy: number): Roi {
  switch (handle) {
    case 'nw':
      return { ...start, left: start.left + dx, top: start.top + dy };
    case 'ne':
      return { ...start, right: start.right + dx, top: start.top + dy };
    case 'sw':
      return { ...start, left: start.left + dx, bottom: start.bottom + dy };
    case 'se':
      return { ...start, right: start.right + dx, bottom: start.bottom + dy };
    default:
      return {
        left: start.left + dx,
        top: start.top + dy,
        right: start.right + dx,
        bottom: start.bottom + dy,
      };
  }
}

function clampRoi(roi: Roi): Roi {
  const minSize = 0.12;
  const left = Math.min(Math.max(roi.left, 0), 1 - minSize);
  const top = Math.min(Math.max(roi.top, 0), 1 - minSize);
  const right = Math.max(Math.min(roi.right, 1), left + minSize);
  const bottom = Math.max(Math.min(roi.bottom, 1), top + minSize);
  return { left, top, right, bottom };
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#00E5A0',
    backgroundColor: 'rgba(0, 229, 160, 0.08)',
  },
  handle: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 2,
    backgroundColor: '#00E5A0',
  },
  nw: { top: -9, left: -9 },
  ne: { top: -9, right: -9 },
  sw: { bottom: -9, left: -9 },
  se: { bottom: -9, right: -9 },
  caption: {
    position: 'absolute',
    top: -22,
    left: 0,
    backgroundColor: '#00E5A0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  captionText: {
    color: '#04110C',
    fontSize: 11,
    fontWeight: '700',
  },
});
