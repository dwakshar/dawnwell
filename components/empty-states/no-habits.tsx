import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';

import { Title, Body } from '@/components/ui/typography';
import Button from '@/components/ui/button';
import Reveal from '@/components/ui/reveal';

type Props = {
  title?: string;
  body?: string;
  paddingHorizontal?: number;
};

export default function EmptyNoHabits({
  title = 'No history yet',
  body = 'Create your first habit to start building a rhythm.',
  paddingHorizontal = 20,
}: Props) {
  return (
    <Reveal direction="up" delay={80}>
      <View
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: 80,
          paddingHorizontal,
          gap: 16,
        }}
      >
        <Title style={{ textAlign: 'center' }}>{title}</Title>
        <Body color="ink-mute" align="center" style={{ maxWidth: 280 }}>
          {body}
        </Body>
        <Button
          variant="primary"
          size="md"
          accessibilityLabel="Create your first habit"
          onPress={() => router.navigate('/')}
        >
          Create habit
        </Button>
      </View>
    </Reveal>
  );
}
