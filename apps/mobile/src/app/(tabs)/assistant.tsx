import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
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
import { Button, EmptyState, Screen, Symbol, Text } from '@/components/ui';
import { T } from '@/constants/theme';
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

/**
 * One chat bubble, iOS Messages-style. Wrapped in React.memo so that streaming
 * a new reply does not re-render the bubbles that came before it.
 */
const ChatBubble = memo(function ChatBubble({
  message,
  onSeePrices,
  onOpenSos,
  onCallEmergency,
}: {
  message: AssistantMessage;
  onSeePrices: (jobId: string) => void;
  onOpenSos: () => void;
  onCallEmergency: () => void;
}) {
  const isUser = message.role === 'user';

  const text = useMemo(
    () =>
      message.parts
        .filter((p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text')
        .map((p) => p.text)
        .join(''),
    [message.parts]
  );

  const links = useMemo(
    () => (message.role === 'assistant' ? extractLinksFromText(text) : []),
    [message.role, text]
  );

  const hasEmergencyNotice =
    message.role === 'assistant' && isEmergencyReplyText(text);

  return (
    <View
      accessibilityLabel={isUser ? `You said: ${text}` : `Vyana Assistant said: ${text}`}
      style={[
        styles.bubble,
        isUser ? styles.userBubble : styles.assistantBubble,
        hasEmergencyNotice && styles.emergencyBubble,
      ]}
    >
      {/* Tool activity */}
      {message.parts.map((part, idx) => {
        if (part.type === 'tool-search_health_web' || part.type === 'tool-read_page') {
          return (
            <View key={`tool-${idx}`} style={styles.toolPill}>
              <ActivityIndicator size="small" color={T.color.accent} />
              <Text variant="footnote" tone="secondary">
                Searching trusted sources…
              </Text>
            </View>
          );
        }

        if (part.type === 'tool-compare_medicine_prices') {
          const output =
            'output' in part && part.output && typeof part.output === 'object'
              ? (part.output as { status?: string; job_id?: string })
              : null;
          if (output?.job_id) {
            return (
              <Button
                key={`tool-${idx}`}
                title="See prices"
                variant="secondary"
                size="sm"
                label="See medicine prices in basket comparison"
                onPress={() => onSeePrices(output.job_id as string)}
                icon={<Symbol ios="tag.fill" android="sell" size={14} color={T.color.accentStrong} />}
                style={styles.inlineAction}
              />
            );
          }
          return (
            <View key={`tool-${idx}`} style={styles.toolPill}>
              <ActivityIndicator size="small" color={T.color.accent} />
              <Text variant="footnote" tone="secondary">
                Comparing pharmacy prices…
              </Text>
            </View>
          );
        }

        return null;
      })}

      {text.length > 0 && (
        <Text variant="body" tone={isUser ? 'white' : 'label'}>
          {text}
        </Text>
      )}

      {hasEmergencyNotice && (
        <View style={styles.emergencyActions}>
          <Button
            title={`Call ${EMERGENCY.ambulance} now`}
            variant="destructive"
            size="sm"
            label="Call 108 Ambulance Now"
            onPress={onCallEmergency}
            icon={<Symbol ios="phone.fill" android="call" size={14} color={T.color.dangerText} />}
            style={styles.inlineAction}
          />
          <Button
            title="Open SOS"
            variant="secondary"
            size="sm"
            label="Open SOS Emergency Screen"
            onPress={onOpenSos}
            style={styles.inlineAction}
          />
        </View>
      )}

      {/* Sources as small link chips under the answer */}
      {links.length > 0 && (
        <View style={styles.chipsRow}>
          <Text variant="caption" tone="tertiary" style={styles.sourcesLabel}>
            Sources
          </Text>
          <View style={styles.chipsWrap}>
            {links.map((src) => (
              <Pressable
                key={src.url}
                accessibilityRole="link"
                accessibilityLabel={`Open source: ${src.title}`}
                onPress={() => Linking.openURL(src.url)}
                style={styles.chip}
              >
                <Symbol ios="link" android="link" size={12} color={T.color.accentStrong} />
                <Text variant="footnote" tone="accent" numberOfLines={1} style={styles.chipText}>
                  {src.title}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {message.role === 'assistant' && (
        <MobileAiSafetyBanner feature="assistant_chat" aiRunId={message.metadata?.ai_run_id} />
      )}
    </View>
  );
});

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

  const handleSeePrices = useCallback(
    (jobId: string) => {
      router.push(`/basket?job_id=${jobId}` as never);
    },
    [router]
  );
  const handleOpenSos = useCallback(() => router.push('/sos'), [router]);
  const handleCallEmergency = useCallback(() => {
    Linking.openURL(`tel:${EMERGENCY.ambulance}`);
  }, []);

  return (
    <Screen
      title="Ask Vyana"
      scroll={false}
      trailing={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Emergency SOS — Call 108 Ambulance"
          onPress={() => router.push('/sos')}
          style={styles.sosHeaderBtn}
        >
          <Text variant="footnote" tone="danger" style={styles.sosHeaderText}>
            SOS 108
          </Text>
        </Pressable>
      }
    >
      <View style={styles.keyboard}>
        <ScrollView
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Emergency notice */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Medical emergency? Tap to open SOS 108"
            onPress={handleOpenSos}
            style={styles.emergencyStrip}
          >
            <Symbol
              ios="exclamationmark.triangle.fill"
              android="warning"
              size={16}
              color={T.color.dangerText}
            />
            <Text variant="footnote" tone="danger" style={styles.emergencyStripText}>
              Chest pain or severe symptoms? Tap for SOS {EMERGENCY.ambulance}
            </Text>
          </Pressable>

          {/* Language + new chat */}
          <View style={styles.langBar}>
            {(
              [
                { id: 'en', title: 'English' },
                { id: 'hi', title: 'Hindi' },
                { id: 'hinglish', title: 'Hinglish' },
              ] as const
            ).map((item) => {
              const active = currentLang === item.id;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Switch assistant language to ${item.title}`}
                  onPress={() => handleLanguageChange(item.id)}
                  style={[styles.langChip, active && styles.langChipActive]}
                >
                  <Text variant="footnote" tone={active ? 'white' : 'secondary'} style={styles.langChipText}>
                    {item.title}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start a new chat conversation"
              onPress={handleNewChat}
              style={styles.newChatBtn}
            >
              <Symbol ios="square.and.pencil" android="edit_square" size={14} color={T.color.accentStrong} />
              <Text variant="footnote" tone="accent" style={styles.newChatText}>
                New
              </Text>
            </Pressable>
          </View>

          {/* Quick prompts */}
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
                <Text variant="footnote" tone="accent" style={styles.promptText}>
                  {prompt}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Error state */}
          {error && (
            <View accessibilityRole="alert" style={styles.errorBanner}>
              <Text variant="callout" tone="danger">
                Couldn&apos;t answer right now. For an emergency call {EMERGENCY.ambulance}.
              </Text>
              <View style={styles.errorActions}>
                <Button
                  title={`Call ${EMERGENCY.ambulance}`}
                  variant="destructive"
                  size="sm"
                  label="Call 108 Ambulance"
                  onPress={handleCallEmergency}
                  style={styles.inlineAction}
                />
                <Button
                  title="Open SOS"
                  variant="secondary"
                  size="sm"
                  label="Open SOS Screen"
                  onPress={handleOpenSos}
                  style={styles.inlineAction}
                />
              </View>
            </View>
          )}

          {/* Messages */}
          {messages.length === 0 && !error ? (
            <EmptyState
              ios="sparkles"
              android="auto_awesome"
              title="Ask Vyana Health Assistant"
              body="Ask about your prescriptions, lab results, care plans, or medicine prices in English, Hindi or Hinglish. Vyana never diagnoses conditions or changes your doctor's dosages."
            />
          ) : (
            <View style={styles.feed}>
              {messages.map((msg) => (
                <ChatBubble
                  key={msg.id}
                  message={msg}
                  onSeePrices={handleSeePrices}
                  onOpenSos={handleOpenSos}
                  onCallEmergency={handleCallEmergency}
                />
              ))}
              {isStreaming && (
                <View style={styles.streamingRow}>
                  <ActivityIndicator size="small" color={T.color.accent} />
                  <Text variant="footnote" tone="secondary">
                    Vyana is thinking…
                  </Text>
                </View>
              )}
            </View>
          )}
          <MobileDisclaimerFooter />
        </ScrollView>

        {/* Composer */}
        <View style={styles.composer}>
          <TextInput
            accessibilityLabel="Ask a health question"
            value={input}
            onChangeText={setInput}
            placeholder="Ask in English, Hindi or Hinglish…"
            placeholderTextColor={T.color.label3}
            style={styles.input}
            multiline
          />
          <Button
            title="Send"
            onPress={() => handleSend()}
            disabled={isStreaming || !input.trim()}
            loading={isStreaming}
            label="Send question"
            icon={<Symbol ios="paperplane.fill" android="send" size={16} color={T.color.white} />}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sosHeaderBtn: {
    backgroundColor: T.color.dangerSoft,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: T.radius.pill,
    minHeight: 44,
    justifyContent: 'center',
  },
  sosHeaderText: { fontWeight: '700' },
  keyboard: { flex: 1 },
  messages: { flex: 1 },
  messagesContent: {
    paddingHorizontal: T.space.lg,
    paddingTop: T.space.md,
    paddingBottom: T.space.lg,
    gap: T.space.md,
  },
  emergencyStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: T.space.sm,
    backgroundColor: T.color.dangerSoft,
    borderRadius: T.radius.pill,
    borderCurve: 'continuous',
    paddingHorizontal: T.space.lg,
    paddingVertical: T.space.md,
    minHeight: 44,
  },
  emergencyStripText: { fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  langBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: T.space.sm,
  },
  langChip: {
    backgroundColor: T.color.fill,
    borderRadius: T.radius.pill,
    borderCurve: 'continuous',
    paddingHorizontal: T.space.lg,
    paddingVertical: T.space.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  langChipActive: { backgroundColor: T.color.accent },
  langChipText: { fontWeight: '600' },
  newChatBtn: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.space.xs,
    borderRadius: T.radius.pill,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: T.color.separator,
    backgroundColor: T.color.surface,
    paddingHorizontal: T.space.lg,
    minHeight: 44,
  },
  newChatText: { fontWeight: '700' },
  promptsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: T.space.sm },
  promptPill: {
    backgroundColor: T.color.accentSoft,
    borderRadius: T.radius.pill,
    borderCurve: 'continuous',
    paddingHorizontal: T.space.lg,
    paddingVertical: T.space.sm,
    minHeight: 44,
    justifyContent: 'center',
    maxWidth: '100%',
  },
  promptText: { fontWeight: '600' },
  errorBanner: {
    backgroundColor: T.color.dangerSoft,
    borderRadius: T.radius.card,
    borderCurve: 'continuous',
    padding: T.space.lg,
    gap: T.space.md,
  },
  errorActions: { flexDirection: 'row', gap: T.space.sm, flexWrap: 'wrap' },
  feed: { gap: T.space.md },
  bubble: {
    borderRadius: T.radius.tile,
    borderCurve: 'continuous',
    padding: T.space.lg,
    gap: T.space.sm,
  },
  userBubble: {
    backgroundColor: T.color.accent,
    alignSelf: 'flex-end',
    maxWidth: '88%',
  },
  assistantBubble: {
    backgroundColor: T.color.surface,
    alignSelf: 'stretch',
  },
  emergencyBubble: {
    backgroundColor: T.color.dangerSoft,
    borderWidth: 1,
    borderColor: T.color.danger,
  },
  toolPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: T.space.sm,
    backgroundColor: T.color.fill,
    borderRadius: T.radius.pill,
    borderCurve: 'continuous',
    paddingHorizontal: T.space.md,
    paddingVertical: T.space.sm,
    minHeight: 44,
  },
  inlineAction: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  emergencyActions: { flexDirection: 'row', gap: T.space.sm, flexWrap: 'wrap' },
  chipsRow: { gap: T.space.xs, marginTop: T.space.xs },
  sourcesLabel: { fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: T.space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.space.xs,
    backgroundColor: T.color.accentSoft,
    borderRadius: T.radius.pill,
    borderCurve: 'continuous',
    paddingHorizontal: T.space.md,
    paddingVertical: T.space.sm,
    minHeight: 44,
    maxWidth: '100%',
  },
  chipText: { fontWeight: '600', flexShrink: 1 },
  streamingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.space.sm,
    paddingVertical: T.space.sm,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: T.space.sm,
    backgroundColor: T.color.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.color.separator,
    paddingHorizontal: T.space.lg,
    paddingTop: T.space.sm,
    paddingBottom: T.space.sm,
  },
  input: {
    flex: 1,
    ...T.text.body,
    color: T.color.label,
    backgroundColor: T.color.fill,
    borderRadius: T.radius.row,
    borderCurve: 'continuous',
    paddingHorizontal: T.space.md,
    paddingVertical: T.space.sm,
    minHeight: 46,
    maxHeight: 120,
  },
});
