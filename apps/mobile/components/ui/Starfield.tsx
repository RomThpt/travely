import { StyleSheet, View } from 'react-native';

const STARS = [
  [12, 7, 2],
  [23, 19, 1],
  [36, 11, 2],
  [48, 27, 1],
  [59, 8, 1],
  [72, 20, 2],
  [84, 10, 1],
  [93, 31, 1],
  [7, 42, 1],
  [29, 37, 1],
  [66, 43, 1],
  [78, 35, 1],
] as const;

export function Starfield() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {STARS.map(([left, top, size], index) => (
        <View
          key={index}
          style={[styles.star, { left: `${left}%`, top: `${top}%`, width: size, height: size }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  star: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#D9E8F5',
    opacity: 0.78,
  },
});
