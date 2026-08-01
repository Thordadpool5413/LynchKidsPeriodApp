import React from 'react';
import { Body, Card, Heading, Page } from '@/components/ui';

export default function PrivacyScreen() {
  return (
    <Page>
      <Card tone="aqua"><Heading size={24}>The short version</Heading><Body>Your body information is yours. The free app works on this device without an account. Glitter does not show ads or sell your information.</Body></Card>
      <Card><Heading size={20}>What stays private</Heading><Body>Journal pages and exact Ask Glitter questions stay private unless you choose to share a specific item. Questions are not kept after an answer is shown.</Body></Card>
      <Card><Heading size={20}>What a linked grown-up can see</Heading><Body>After verified grown-up consent, cloud sharing can include period dates, symptoms, mood trends, preparation, and lesson progress. Every child screen shows when this sharing is on.</Body></Card>
      <Card><Heading size={20}>You can change your mind</Heading><Body>You can stop sharing a journal page, export your data, or delete device data. A grown-up can request cloud-account deletion from the parent portal.</Body></Card>
      <Card tone="coral"><Heading size={20}>When something feels unsafe</Heading><Body>Glitter may tell you to get a trusted grown-up right away. It will not secretly message someone. In immediate danger in the U.S., call 911. For a mental health crisis, call or text 988.</Body></Card>
      <Body muted>Production release requires final legal and child-privacy review. This screen is child-readable product copy, not the complete legal privacy policy.</Body>
    </Page>
  );
}
