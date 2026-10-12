# Data layer: query functions and hooks

How the screens read and write Supabase (plan 7.2 and 7.5). Owner: Vaibhav Parmar.

```
db/queries/*.ts   fn(sb, ...args)  ->  typed rows, throws DbError        (no React)
hooks/db/*.ts     useXxx()         ->  React Query hook that calls them   (needs <AppProviders>)
```

Everything runs as the signed-in user, so the database (row level security) decides what comes back.
A patient never gets another patient's rows, however the screen calls it.

## Using a hook

```tsx
const { data: appointments, isLoading, error } = useMyAppointments();
const book = useBookAppointment();

book.mutate(
  { hospital_id, department_id, appointment_date: "2026-10-14", reason: "Fever" },
  { onError: (e) => showToast(e.message) } // 'OPD is closed on that day', 'no tokens left for that day', ...
);
```

- Queries wait until the user is signed in (`enabled`), so they are safe to call in any screen.
- Mutations refresh the related queries on success.
- The cache is dropped when another user signs in.

## Errors

Every function throws a `DbError` with `message` and `code` (the Postgres code):

| `code` | Meaning | Show |
| --- | --- | --- |
| `42501` | Row level security said no | "You do not have access" |
| `23505` | Duplicate (for example the same consent twice) | usually nothing |
| `P0001` | A message written for people by a database function | the `message` as it is |
| `not_signed_in` | No session | send to login |
| `unsupported_file_type` | Upload that is not jpg, png or pdf | "Use a JPG, PNG or PDF" |

`acceptCareInvite` returns `null` (not an error) for a wrong or expired code: show "invalid or expired code".
After 5 wrong codes in 15 minutes it throws `too many attempts`.

## Live updates

Care plans, appointments and drug alerts refresh themselves when the database changes (Realtime, filtered by
row level security): a patient sees a doctor's approval of a care plan without reloading, and a doctor's queue
shows new bookings. `useEmergencyRequest(id)` pushes every change of an SOS request into the cache.

## Query keys

Every key starts with a value of `QUERY_ROOTS` (`hooks/api/query-roots.ts`) when an API hook refreshes it
(for example a prescription scan refreshes `[QUERY_ROOTS.prescriptions]`), otherwise with a `DB_KEYS` value.
A test checks this; follow it when you add a hook.

## Query function to hook

| File | Functions | Hooks |
| --- | --- | --- |
| `profile` | `getMyProfile`, `updateMyProfile`, `completeOnboarding` | `useMyProfile`, `useUpdateProfile`, `useCompleteOnboarding` |
| `doctors` | `listVerifiedDoctors`, `getDoctor`, `upsertMyDoctorProfile`, `getMyDoctorProfile`, `listAllDoctors`, `getFreeSlots` | `useDoctors`, `useDoctor`, `useUpsertDoctorProfile`, `useMyDoctorProfile`, `useFreeSlots` |
| `hospitals` | `listHospitals`, `getHospital`, `listDepartments` | `useHospitals`, `useHospital`, `useDepartments` |
| `appointments` | `bookAppointment`, `listMyAppointments`, `listDoctorQueue`, `updateAppointmentStatus` | `useBookAppointment`, `useMyAppointments`, `useDoctorQueue`, `useUpdateAppointment` |
| `prescriptions` | `listPrescriptions`, `getPrescription`, `createDoctorPrescription`, `setItemActive`, `listActiveItems` | `usePrescriptions`, `usePrescription`, `useCreateDoctorPrescription`, `useSetItemActive`, `useActiveItems` |
| `doses` | `logDose`, `listDoseLogs`, `getAdherence` | `useLogDose`, `useDoseLogs`, `useAdherence` |
| `reports` | `listLabReports`, `getLabReport`, `listLabValueHistory` | `useLabReports`, `useLabReport`, `useLabValueHistory` |
| `vitals` | `listVitals`, `addVital` | `useVitals`, `useAddVital` |
| `meals` | `listMeals`, `addMeal` | `useMeals`, `useAddMeal` |
| `contacts` | `listEmergencyContacts`, `addEmergencyContact`, `deleteEmergencyContact` | `useEmergencyContacts`, `useAddContact`, `useDeleteContact` |
| `conditions` | `listConditions`, `addCondition`, `updateCondition`, `deleteCondition` | `useConditions`, `useAddCondition`, `useUpdateCondition`, `useDeleteCondition` |
| `carePlans` | `getCarePlan`, `listCarePlans`, `approveCarePlan` | `useCarePlan`, `useCarePlans`, `useApproveCarePlan` |
| `careLinks` | `createCareInvite`, `acceptCareInvite`, `listMyCaregivers`, `listMyPatients`, `revokeCareLink` | `useCareInvite`, `useAcceptCareInvite`, `useMyCaregivers`, `useMyPatients`, `useRevokeCareLink` |
| `shareLinks` | `createShareLink`, `listShareLinks`, `revokeShareLink` | `useCreateShareLink`, `useShareLinks`, `useRevokeShareLink` |
| `consents` | `getConsent`, `acceptConsent` | `useConsent`, `useAcceptConsent` |
| `timeline` | `getTimeline` | `useTimeline` |
| `aiRuns` | `reportAiMistake` | `useReportAiMistake` |
| `chat` | `listChatSessions`, `getChatMessages` | `useChatSessions`, `useChatMessages` |
| `alerts` | `listDrugAlerts`, `markAlertSeen` | `useDrugAlerts`, `useMarkAlertSeen` |
| `emergency` | `getEmergencyRequest`, `cancelEmergency`, `subscribeEmergency` | `useEmergencyRequest` |
| `storage` | `uploadFile`, `getSignedUrl` | none (call directly) |
| `push` | `savePushToken` | none (call directly) |

Uploads: `uploadFile(sb, BUCKETS.prescriptions, file, "jpg")` returns the `file_path` to store on the row.
On a phone pass `{ uri, mimeType }`; on the web pass the `File`.
