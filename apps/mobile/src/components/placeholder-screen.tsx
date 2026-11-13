import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

type Props = {
  title: string;
  description: string;
  todo?: string[];
};

/** Temporary screen body. Replace it with the real screen when you implement the feature. */
export function PlaceholderScreen({ title, description, todo = [] }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {todo.length > 0 && (
        <View style={styles.box}>
          <Text style={styles.boxTitle}>To implement</Text>
          {todo.map((item) => (
            <Text key={item} style={styles.item}>
              {'\u2022'} {item}
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 64,
    gap: 12,
    backgroundColor: colors.background,
    flexGrow: 1,
  },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  description: { fontSize: 15, color: colors.textMuted, lineHeight: 22 },
  box: {
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  boxTitle: { fontWeight: '600', color: colors.text },
  item: { fontSize: 14, color: colors.text, lineHeight: 20 },
});
