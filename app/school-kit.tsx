import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { hasPlusAccess } from '@shared/entitlements';
import { useAppStore } from '@/store/app-store';
import { Body, Card, ChoiceChip, Heading, Page, PremiumBadge } from '@/components/ui';

const kitItems = ['Two pads or liners', 'Spare underwear', 'Small sealable bag', 'Skin-safe wipes', 'Trusted adult plan'];

export default function SchoolKitScreen() {
  const { data } = useAppStore();
  const premium = hasPlusAccess(data.entitlement);
  const [checked, setChecked] = useState<string[]>([]);
  return (
    <Page>
      <Card tone="aqua"><PremiumBadge /><Heading size={24}>Quiet confidence for school</Heading><Body>Build a small kit and practice simple words before you need them.</Body></Card>
      <Card>
        <Heading size={20}>My little kit</Heading>
        {kitItems.map((item) => <ChoiceChip key={item} label={item} emoji={checked.includes(item) ? '✅' : '○'} selected={checked.includes(item)} onPress={() => premium && setChecked((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item])} />)}
        {!premium ? <Body muted>Start the Plus preview to use the interactive checklist.</Body> : null}
      </Card>
      <Card tone="butter"><Heading size={20}>Words you can use</Heading><Body>“I need to use the bathroom for a personal health reason.”</Body><Body>“Could I visit the nurse? I need a period product.”</Body><Body>“I had a leak. Can I call my grown-up or get something to cover it?”</Body></Card>
      <Card><Heading size={20}>Choose your people</Heading><Body muted>Think of one teacher, nurse, coach, or office staff member you can ask. You never have to explain more than you want to.</Body><Text style={{ fontSize: 34 }}>🤝</Text></Card>
    </Page>
  );
}
