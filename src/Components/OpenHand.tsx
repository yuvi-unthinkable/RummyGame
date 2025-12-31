import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ScrollView,
} from 'react-native';
import React, { useState } from 'react';
import { Canvas, useImage } from '@shopify/react-native-skia'; // 1. Import Canvas
import { useSharedValue } from 'react-native-reanimated';
import { CardData } from './Playground';
import Card from './Card';

type OpenHandProps = {
  visible: boolean;
  player: string;
  onClose: () => void;
  onProceed: (card: CardData) => void;
  hand: CardData[];
};

export default function OpenHand({
  visible,
  onClose,
  player,
  onProceed,
  hand,
}: OpenHandProps) {
  const { width } = useWindowDimensions();
  const backCardImg = useImage(require('../../assets/cardBackGround.png'));

  // Dimensions for the modal view
  const cardWidth = width * 0.15;
  const cardHeight = cardWidth * 1.4;

  // 2. Create Static SharedValues
  // We pass 0 for X and Y because the Canvas itself will be positioned by Flexboxhdrrf
  const staticZero = useSharedValue(0);
  const staticFaceUp = useSharedValue(true); // Always show face up in handc

  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);

  const handleSelect = (card: CardData) => {
    setSelectedCardId(card.meta.id);
  };

  const handleConfirm = () => {
    const card = hand.find(c => c.meta.id === selectedCardId);
    if (card) {
      onProceed(card);
      setSelectedCardId(null);
    }
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.box} onPress={e => e.stopPropagation()}>
          <Text style={styles.title}>{player}'s Hand</Text>
          <Text style={styles.subtitle}>Select a card to play</Text>

          <ScrollView contentContainerStyle={styles.grid}>
            {hand.map(card => {
              const isSelected = selectedCardId === card.meta.id;

              return (
                <Pressable
                  key={card.meta.id}
                  onPress={() => handleSelect(card)}
                  style={[
                    styles.cardWrapper,
                    { width: cardWidth, height: cardHeight }, // Enforce sizee
                    isSelected && styles.selectedWrapper,
                    

                  ]}
                >
                  <Canvas style={{ flex: 1, zIndex: 2000 }}>
                    {backCardImg && (
                      <Card
                        x={staticZero}
                        y={staticZero}
                        faceUp={staticFaceUp}
                        backCardImg={backCardImg}
                        faceCardImg={card.cardFaceImg}
                        cardWidth={cardWidth}
                        cardHeight={cardHeight}
                      />
                    )}
                  </Canvas>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              style={[styles.confirmBtn, !selectedCardId && styles.disabledBtn]}
              disabled={!selectedCardId}
            >
              <Text style={styles.confirmText}>Play Card</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  box: {
    width: '90%',
    maxHeight: '70%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 5,
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 15,
    paddingBottom: 20,
  },
  cardWrapper: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  selectedWrapper: {
    borderColor: '#006eff',
    borderWidth: 3,
    transform: [{ scale: 1.1 }],
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 15,
  },
  cancelBtn: { padding: 10 },
  cancelText: { color: 'red', fontWeight: '600' },
  confirmBtn: {
    backgroundColor: '#006eff',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  disabledBtn: { backgroundColor: '#ccc' },
  confirmText: { color: '#fff', fontWeight: 'bold' },
});
