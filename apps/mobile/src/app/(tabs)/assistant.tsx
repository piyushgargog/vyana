import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { fetch as expoFetch } from 'expo/fetch';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import {
  EMERGENCY,
  useApi,
  useChatMessages,
  useChatSessions,
  useMyProfile,
  useUpdateProfile,
  type Language,
} from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import {
  MobileAiSafetyBanner,
  MobileDisclaimerFooter,
} from '@/components/ui-primitives';

type AssistantMessage = UIMessage<{ ai_run_id?: string }>;

const MARKDOWN_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

function extractLinksFromText(text: string): { title: string; url: string }[] {
  const found: { title: string; url: string }[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(MARKDOWN_LINK_RE)) {
    const title = match[1]?.trim();
    const url = match[2]?.trim();
    if (title && url && !seen.has(url)) {
      seen.add(url);
      found.push({ title, url });
    }
  }
  return found;
}

function isEmergencyReplyText(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.startsWith('if this is an emergency') ||
    normalized.includes('call 108') ||
    normalized.includes('108 पर कॉल') ||
    normalized.includes('108 par call')
  );
}

export default function MobileAssistantTab() {
  const router = useRouter();
  const api = useApi();
  const { showToast } = useVyanaMobile();

  const { data: profile } = useMyProfile();
  const updateProfileMutation = useUpdateProfile();
  const { data: sessions = [] } = useChatSessions();

  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const hydratedSessionRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!sessionId && sessions.length > 0 && !hydratedSessionRef.current) {
      setSessionId(sessions[0].id);
    }
  }, [sessions, sessionId]);

  const { data: savedMessages } = useChatMessages(sessionId);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<AssistantMessage>({
        api: api.chatUrl,
        headers: () => api.authHeaders(),
        body: sessionId ? { session_id: sessionId } : {},
        fetch: (async (input, init) => {
          const res = await (expoFetch as unknown as typeof globalThis.fetch)(
            input,
            init
          );
          const nextSessionId = res.headers.get('x-session-id');
          if (nextSessionId && nextSessionId !== sessionId) {
            setSessionId(nextSessionId);
          }
          return res;
        }) as typeof globalThis.fetch,
      }),
    [api, sessionId]
  );

  const { messages, setMessages, sendMessage, status, error, clearError } =
    useChat<AssistantMessage>({
      transport,
    });

  useEffect(() => {
    if (
      sessionId &&
      savedMessages &&
      hydratedSessionRef.current !== sessionId &&
      status === 'ready'
    ) {
      hydratedSessionRef.current = sessionId;
      const mapped: AssistantMessage[] = savedMessages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          parts: Array.isArray(m.parts)
            ? (m.parts as unknown as AssistantMessage['parts'])
            : [{ type: 'text' as const, text: String(m.parts ?? '') }],
        }));
      setMessages(mapped);
    }
  }, [sessionId, savedMessages, setMessages, status]);

  const [input, setInput] = useState('');
  const currentLang: Language =
    profile?.preferred_language === 'hi' ||
    profile?.preferred_language === 'hinglish'
      ? profile.preferred_language
      : 'en';

  const isStreaming = status === 'submitted' || status === 'streaming';

  const handleLanguageChange = async (nextLang: Language) => {
    try {
      await updateProfileMutation.mutateAsync({ preferred_language: nextLang });
      showToast(`Assistant language set to ${nextLang}`, 'info');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Could not update language',
        'error'
      );
    }
  };

  const handleNewChat = () => {
    hydratedSessionRef.current = 'new';
    setSessionId(undefined);
    clearError();
    setMessages([]);
  };

  const handleSend = async (presetText?: string) => {
    const text = (presetText ?? input).trim();
    if (!text || isStreaming) return;
    if (!presetText) setInput('');
    clearError();
    await sendMessage({ text });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Emergency Red Notice Bar */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Medical emergency? Tap to open SOS 108 modal"
        onPress={() => router.push('/sos')}
        style={styles.emergencyStrip}
      >
        <Text style={styles.emergencyStripText}>
          Experiencing chest pain or severe symptoms? Tap here for SOS{' '}
          {EMERGENCY.ambulance} →
        </Text>
      </Pressable>

      {/* Language Switcher + New Conversation */}
      <View style={styles.langBar}>
        <Text style={styles.langLabel}>Language:</Text>
        {(
          [
            { id: 'en', title: 'English' },
            { id: 'hi', title: 'हिंदी' },
            { id: 'hinglish', title: 'Hinglish' },
          ] as const
        ).map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityState={{ selected: currentLang === item.id }}
            accessibilityLabel={`Switch assistant language to ${item.title}`}
            onPress={() => handleLanguageChange(item.id)}
            style={[
              styles.langChip,
              currentLang === item.id && styles.langChipActive,
            ]}
          >
            <Text
              style={[
                styles.langChipText,
                currentLang === item.id && styles.langChipTextActive,
              ]}
            >
              {item.title}
            </Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start a new chat conversation"
          onPress={handleNewChat}
          style={styles.newChatBtn}
        >
          <Text style={styles.newChatBtnText}>+ New</Text>
        </Pressable>
      </View>

      {/* Quick Prompts */}
      <View style={styles.promptsWrap}>
        {[
          'Summarize my active medicines and schedule',
          'Explain my latest lab report in simple words',
          'Check pharmacy prices for my active medicines',
        ].map((prompt) => (
          <Pressable
            key={prompt}
            accessibilityRole="button"
            accessibilityLabel={`Ask: ${prompt}`}
            disabled={isStreaming}
            onPress={() => handleSend(prompt)}
            style={styles.promptPill}
          >
            <Text style={styles.promptPillText}>{prompt}</Text>
          </Pressable>
        ))}
      </View>

      {/* Error State — Never fabricate a medical answer */}
      {error && (
        <View accessibilityRole="alert" style={styles.errorBanner}>
          <Text style={styles.errorBannerTitle}>
            Couldn&apos;t answer right now. For an emergency call{' '}
            {EMERGENCY.ambulance}.
          </Text>
          <View style={styles.errorActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Call 108 Ambulance"
              onPress={() => Linking.openURL(`tel:${EMERGENCY.ambulance}`)}
              style={styles.call108Btn}
            >
              <Text style={styles.call108BtnText}>
                Call {EMERGENCY.ambulance} Ambulance
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open SOS Screen"
              onPress={() => router.push('/sos')}
              style={styles.sosSecondaryBtn}
            >
              <Text style={styles.sosSecondaryBtnText}>Open SOS</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Messages Feed */}
      <View style={styles.feed}>
        {messages.length === 0 && !error && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Ask Vyana Health Assistant</Text>
            <Text style={styles.emptySub}>
              Ask about your prescriptions, lab results, care plans, or medicine
              prices in English, हिंदी, or Hinglish. Vyana never diagnoses
              conditions or changes your doctor&apos;s dosages.
            </Text>
          </View>
        )}

        {messages.map((msg) => {
          const textParts = msg.parts
            .filter(
              (p): p is Extract<typeof p, { type: 'text' }> =>
                p.type === 'text'
            )
            .map((p) => p.text)
            .join('');

          const links =
            msg.role === 'assistant' ? extractLinksFromText(textParts) : [];
          const hasEmergencyNotice =
            msg.role === 'assistant' && isEmergencyReplyText(textParts);

          return (
            <View
              key={msg.id}
              style={[
                styles.bubble,
                msg.role === 'user'
                  ? styles.userBubble
                  : styles.assistantBubble,
                hasEmergencyNotice && styles.emergencyBubble,
              ]}
            >
              <Text style={styles.bubbleRole}>
                {msg.role === 'user' ? 'You' : 'Vyana Assistant (AI)'}
              </Text>

              {/* Tool parts */}
              {msg.parts.map((part, idx) => {
                if (
                  part.type === 'tool-search_health_web' ||
                  part.type === 'tool-read_page'
                ) {
                  return (
                    <View key={`tool-${idx}`} style={styles.toolStatusPill}>
                      <Text style={styles.toolStatusText}>
                        Searching trusted sources…
                      </Text>
                    </View>
                  );
                }

                if (part.type === 'tool-compare_medicine_prices') {
                  const output =
                    'output' in part &&
                    part.output &&
                    typeof part.output === 'object'
                      ? (part.output as { status?: string; job_id?: string })
                      : null;
                  if (output?.job_id) {
                    return (
                      <Pressable
                        key={`tool-${idx}`}
                        accessibilityRole="button"
                        accessibilityLabel="See medicine prices in basket comparison"
                        onPress={() =>
                          router.push(`/basket?job_id=${output.job_id}` as never)
                        }
                        style={styles.seePricesBtn}
                      >
                        <Text style={styles.seePricesBtnText}>
                          See prices →
                        </Text>
                      </Pressable>
                    );
                  }
                  return (
                    <View key={`tool-${idx}`} style={styles.toolStatusPill}>
                      <Text style={styles.toolStatusText}>
                        Comparing pharmacy prices…
                      </Text>
                    </View>
                  );
                }

                return null;
              })}

              {textParts.length > 0 && (
                <Text
                  style={[
                    styles.bubbleText,
                    msg.role === 'user' && styles.userBubbleText,
                  ]}
                >
                  {textParts}
                </Text>
              )}

              {hasEmergencyNotice && (
                <View style={styles.errorActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Call 108 Ambulance Now"
                    onPress={() =>
                      Linking.openURL(`tel:${EMERGENCY.ambulance}`)
                    }
                    style={styles.call108Btn}
                  >
                    <Text style={styles.call108BtnText}>
                      Call {EMERGENCY.ambulance} Ambulance Now
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open SOS Emergency Screen"
                    onPress={() => router.push('/sos')}
                    style={styles.sosSecondaryBtn}
                  >
                    <Text style={styles.sosSecondaryBtnText}>Open SOS</Text>
                  </Pressable>
                </View>
              )}

              {links.length > 0 && (
                <View style={styles.sourcesBox}>
                  <Text style={styles.sourcesHeader}>Sources:</Text>
                  {links.map((src) => (
                    <Pressable
                      key={src.url}
                      accessibilityRole="link"
                      accessibilityLabel={`Open source ${src.title}`}
                      onPress={() => Linking.openURL(src.url)}
                    >
                      <Text style={styles.sourceLink}>• {src.title} ↗</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {msg.role === 'assistant' && (
                <MobileAiSafetyBanner
                  feature="assistant_chat"
                  aiRunId={msg.metadata?.ai_run_id}
                />
              )}
            </View>
          );
        })}

        {isStreaming && (
          <View style={styles.streamingRow}>
            <ActivityIndicator size="small" color="#0D9488" />
            <Text style={styles.streamingText}>Vyana is thinking…</Text>
          </View>
        )}
      </View>

      {/* Input Composer */}
      <View style={styles.composerCard}>
        <Text style={styles.inputLabel}>Ask a health question</Text>
        <View style={styles.composerRow}>
          <TextInput
            accessibilityLabel="Ask a health question"
            value={input}
            onChangeText={setInput}
            placeholder="Ask in English, हिंदी, or Hinglish…"
            style={styles.input}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send question"
            disabled={isStreaming || !input.trim()}
            onPress={() => handleSend()}
            style={[
              styles.sendBtn,
              (isStreaming || !input.trim()) && styles.sendBtnDisabled,
            ]}
          >
            <Text style={styles.sendBtnText}>
              {isStreaming ? '…' : 'Send'}
            </Text>
          </Pressable>
        </View>
      </View>

      <MobileDisclaimerFooter />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, gap: 12 },
  emergencyStrip: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  emergencyStripText: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  langBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  langLabel: { fontSize: 12, fontWeight: '700', color: '#475569' },
  langChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
  },
  langChipActive: { backgroundColor: '#0D9488' },
  langChipText: { fontSize: 12, fontWeight: '600', color: '#334155' },
  langChipTextActive: { color: '#FFFFFF', fontWeight: '700' },
  newChatBtn: {
    marginLeft: 'auto',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  newChatBtnText: { fontSize: 11, fontWeight: '700', color: '#0F172A' },
  promptsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  promptPill: {
    backgroundColor: '#F0FDFA',
    borderColor: '#99F6E4',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  promptPillText: { fontSize: 12, fontWeight: '600', color: '#0F766E' },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderColor: '#DC2626',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  errorBannerTitle: {
    color: '#991B1B',
    fontSize: 13,
    fontWeight: '700',
  },
  errorActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  feed: { gap: 10 },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  emptySub: { fontSize: 12, color: '#475569', lineHeight: 18 },
  bubble: {
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  userBubble: {
    backgroundColor: '#0F766E',
    alignSelf: 'flex-end',
    maxWidth: '88%',
  },
  assistantBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignSelf: 'flex-start',
    width: '100%',
  },
  emergencyBubble: {
    backgroundColor: '#FEF2F2',
    borderColor: '#DC2626',
    borderWidth: 2,
  },
  bubbleRole: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: '#64748B',
  },
  bubbleText: { fontSize: 13, lineHeight: 20, color: '#0F172A' },
  userBubbleText: { color: '#FFFFFF' },
  toolStatusPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  toolStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  seePricesBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#0D9488',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  seePricesBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  call108Btn: {
    flex: 1,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  call108BtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  sosSecondaryBtn: {
    borderWidth: 1,
    borderColor: '#DC2626',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  sosSecondaryBtnText: { color: '#DC2626', fontSize: 12, fontWeight: '800' },
  sourcesBox: {
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 3,
  },
  sourcesHeader: { fontSize: 11, fontWeight: '700', color: '#475569' },
  sourceLink: {
    fontSize: 11,
    color: '#0F766E',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  streamingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  streamingText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  composerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  inputLabel: { fontSize: 11, fontWeight: '700', color: '#334155' },
  composerRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  sendBtn: {
    backgroundColor: '#0D9488',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});
