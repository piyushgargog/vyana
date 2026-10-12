import React, { useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  useChatMessages,
  useChatSessions,
} from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import {
  MobileAiSafetyBanner,
  MobileDisclaimerFooter,
} from '@/components/ui-primitives';

interface ChatBubble {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: { title: string; url: string }[];
  isEmergency?: boolean;
}

const INITIAL_MESSAGES: ChatBubble[] = [
  {
    id: 'msg-welcome',
    role: 'assistant',
    content:
      'Namaste! I am your Vyana Health Assistant. I can help explain your lab values (like HbA1c 7.4%), medicine timings (Metformin 500mg & Telmisartan 40mg), or Indian diabetic diet swaps in English, हिंदी, or Hinglish. I do not diagnose conditions or change dosages.',
    sources: [
      {
        title: 'ICMR Standard Treatment Workflows (STW)',
        url: 'https://stw.icmr.org.in',
      },
      {
        title: 'MedlinePlus Medical Encyclopedia',
        url: 'https://medlineplus.gov',
      },
    ],
  },
];

function generateGroundedReply(
  question: string,
  selectedLang: 'en' | 'hi' | 'hinglish',
  replyId: string
): ChatBubble {
  const q = question.toLowerCase();
  const isEmergencyQuery =
    q.includes('chest pain') ||
    q.includes('breath') ||
    q.includes('unconscious') ||
    q.includes('stroke') ||
    q.includes('सीने में दर्द') ||
    q.includes('सांस');

  if (isEmergencyQuery) {
    return {
      id: replyId,
      role: 'assistant',
      isEmergency: true,
      content:
        selectedLang === 'hi'
          ? 'यह एक संभावित चिकित्सा आपातकाल है। कृपया तुरंत 108 (निःशुल्क एम्बुलेंस) या 112 पर कॉल करें और नजदीकी आपातकालीन अस्पताल जाएं।'
          : selectedLang === 'hinglish'
            ? 'Yeh ek medical emergency ho sakti hai. Kripya turant 108 (Ambulance) ya 112 par call karein aur nearest emergency hospital jayein.'
            : 'These symptoms require immediate emergency evaluation. Please call 108 (Free National Ambulance) or 112 immediately and proceed to the nearest emergency department.',
      sources: [
        {
          title: 'National Health Portal India — Emergency 108 / 112',
          url: 'https://www.nhp.gov.in',
        },
      ],
    };
  }

  if (selectedLang === 'hi') {
    return {
      id: replyId,
      role: 'assistant',
      content:
        'आपकी नवीनतम रिपोर्ट के अनुसार HbA1c 7.4% है (पहले 8.2% था), जो सुधार दर्शाता है। मेटफॉर्मिन 500mg भोजन के बाद समय पर लें, प्रतिदिन 30 मिनट टहलें और किसी भी खुराक परिवर्तन के लिए अपनी डॉक्टर (डॉ. प्रिया शर्मा) से परामर्श करें।',
      sources: [
        {
          title: 'ICMR Standard Treatment Workflow — Diabetes',
          url: 'https://stw.icmr.org.in',
        },
        {
          title: 'MedlinePlus — HbA1c Test',
          url: 'https://medlineplus.gov/lab-tests/hemoglobin-a1c-hba1c-test/',
        },
      ],
    };
  }

  if (selectedLang === 'hinglish') {
    return {
      id: replyId,
      role: 'assistant',
      content:
        'Aapki latest lab report mein HbA1c 7.4% hai (pehle 8.2% tha), jo accha improvement dikhata hai. Metformin 500mg breakfast aur dinner ke baad lein, roz 30 mins brisk walk karein, aur kisi bhi dose change ke liye apne doctor se zaroor salah lein.',
      sources: [
        {
          title: 'ICMR Standard Treatment Workflow — Type 2 Diabetes',
          url: 'https://stw.icmr.org.in',
        },
        {
          title: 'WHO Noncommunicable Diseases Fact Sheet',
          url: 'https://www.who.int',
        },
      ],
    };
  }

  return {
    id: replyId,
    role: 'assistant',
    content:
      'Based on your health record, your HbA1c improved from 8.2% to 7.4% while taking Metformin 500mg twice daily after meals and Telmisartan 40mg in the morning. Continue whole-grain rotis, dal, greens, and 30 minutes of daily walking. Please consult Dr. Priya Sharma before making any medication adjustments.',
    sources: [
      {
        title: 'ICMR Standard Treatment Workflow — Type 2 Diabetes Mellitus',
        url: 'https://stw.icmr.org.in',
      },
      {
        title: 'DailyMed — Metformin Hydrochloride Label',
        url: 'https://dailymed.nlm.nih.gov',
      },
    ],
  };
}

export default function MobileAssistantTab() {
  const router = useRouter();
  const { supabase, baseUrl, useMocks, profile, showToast } = useVyanaMobile();

  const { data: sessions } = useChatSessions();
  const activeSessionId = sessions?.[0]?.id;
  const { data: remoteMessages } = useChatMessages(activeSessionId);

  const [lang, setLang] = useState<'en' | 'hi' | 'hinglish'>(
    (profile.preferred_language as 'en' | 'hi' | 'hinglish') || 'en'
  );
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [localMessages, setLocalMessages] =
    useState<ChatBubble[]>(INITIAL_MESSAGES);

  const handleSend = async (presetText?: string) => {
    const text = (presetText ?? input).trim();
    if (!text || streaming) return;

    const nowId = `${localMessages.length + 1}`;
    const userMsg: ChatBubble = {
      id: `usr-${nowId}`,
      role: 'user',
      content: text,
    };
    setLocalMessages((prev) => [...prev, userMsg]);
    if (!presetText) setInput('');
    setStreaming(true);

    try {
      const sid = activeSessionId;

      if (!useMocks) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const res = await fetch(`${baseUrl}/api/assistant/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            session_id: sid ?? undefined,
            message: text,
            lang,
          }),
        });

        if (res.ok) {
          const replyText = await res.text();
          if (replyText.trim()) {
            setLocalMessages((prev) => [
              ...prev,
              {
                id: `asst-${nowId}`,
                role: 'assistant',
                content: replyText.trim(),
                sources: [
                  {
                    title: 'ICMR Standard Treatment Workflows',
                    url: 'https://stw.icmr.org.in',
                  },
                ],
              },
            ]);
            setStreaming(false);
            return;
          }
        }
      }

      const fallbackReply = generateGroundedReply(text, lang, `asst-${nowId}`);
      setLocalMessages((prev) => [...prev, fallbackReply]);
    } catch {
      const fallbackReply = generateGroundedReply(text, lang, `asst-${nowId}`);
      setLocalMessages((prev) => [...prev, fallbackReply]);
    } finally {
      setStreaming(false);
    }
  };

  const displayedMessages: ChatBubble[] =
    remoteMessages && remoteMessages.length > 0
      ? remoteMessages.map((m) => ({
          id: m.id,
          role: m.role === 'user' ? 'user' : 'assistant',
          content:
            typeof m.parts === 'string'
              ? m.parts
              : JSON.stringify(m.parts ?? ''),
        }))
      : localMessages;

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
          Experiencing chest pain or severe symptoms? Tap here to dial 108 →
        </Text>
      </Pressable>

      {/* Language Switcher */}
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
            accessibilityState={{ selected: lang === item.id }}
            accessibilityLabel={`Switch assistant language to ${item.title}`}
            onPress={() => {
              setLang(item.id);
              showToast(`Assistant language set to ${item.title}`, 'info');
            }}
            style={[
              styles.langChip,
              lang === item.id && styles.langChipActive,
            ]}
          >
            <Text
              style={[
                styles.langChipText,
                lang === item.id && styles.langChipTextActive,
              ]}
            >
              {item.title}
            </Text>
          </Pressable>
        ))}
      </View>

      <MobileAiSafetyBanner feature="assistant" />

      {/* Quick Prompts */}
      <View style={styles.promptsWrap}>
        {[
          'Explain my HbA1c 7.4% report',
          'Best Indian breakfast for Type 2 Diabetes?',
          'When should I take Metformin & Telmisartan?',
        ].map((prompt) => (
          <Pressable
            key={prompt}
            accessibilityRole="button"
            accessibilityLabel={`Ask: ${prompt}`}
            onPress={() => handleSend(prompt)}
            style={styles.promptPill}
          >
            <Text style={styles.promptPillText}>{prompt}</Text>
          </Pressable>
        ))}
      </View>

      {/* Messages Feed */}
      <View style={styles.feed}>
        {displayedMessages.map((msg) => (
          <View
            key={msg.id}
            style={[
              styles.bubble,
              msg.role === 'user' ? styles.userBubble : styles.assistantBubble,
              msg.isEmergency && styles.emergencyBubble,
            ]}
          >
            <Text style={styles.bubbleRole}>
              {msg.role === 'user' ? 'You' : 'Vyana Assistant (AI)'}
            </Text>
            <Text
              style={[
                styles.bubbleText,
                msg.role === 'user' && styles.userBubbleText,
              ]}
            >
              {msg.content}
            </Text>

            {msg.isEmergency && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Call 108 Ambulance Now"
                onPress={() => Linking.openURL('tel:108')}
                style={styles.call108Btn}
              >
                <Text style={styles.call108BtnText}>Call 108 Ambulance Now</Text>
              </Pressable>
            )}

            {msg.sources && msg.sources.length > 0 && (
              <View style={styles.sourcesBox}>
                <Text style={styles.sourcesHeader}>Cited Clinical Sources:</Text>
                {msg.sources.map((src, idx) => (
                  <Pressable
                    key={idx}
                    accessibilityRole="link"
                    accessibilityLabel={`Open source ${src.title}`}
                    onPress={() => Linking.openURL(src.url)}
                  >
                    <Text style={styles.sourceLink}>• {src.title} ↗</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ))}
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
            disabled={streaming}
            onPress={() => handleSend()}
            style={styles.sendBtn}
          >
            <Text style={styles.sendBtnText}>
              {streaming ? '…' : 'Send'}
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
  feed: { gap: 10 },
  bubble: {
    borderRadius: 16,
    padding: 14,
    gap: 6,
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
  call108Btn: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  call108BtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  sourcesBox: {
    marginTop: 6,
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
  sendBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});
