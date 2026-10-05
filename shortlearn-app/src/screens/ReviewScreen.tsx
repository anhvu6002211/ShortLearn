import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SavedItemsView, SavedItemsViewProps } from '../components/SavedItemsView';

export type ReviewScreenProps = SavedItemsViewProps;

export const ReviewScreen: React.FC<ReviewScreenProps> = (props) => (
  <View style={styles.container}>
    <SavedItemsView {...props} />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
});
