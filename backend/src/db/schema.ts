import { pgTable, uuid, text, timestamp, foreignKey, check, date, unique, smallint, boolean, index, uniqueIndex, integer, jsonb, inet, pgEnum, customType } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// citext (case-insensitive text) — drizzle-kit's introspection can't parse this
// extension type on its own; institution.emis_id-style plain `text()` won't do,
// since case-insensitive uniqueness on email is exactly the point of using it.
const citext = customType<{ data: string }>({
  dataType() {
    return "citext";
  },
});

export const assessmentKind = pgEnum("assessment_kind", ['lesson', 'test', 'exam', 'project'])
export const credentialStatus = pgEnum("credential_status", ['pending', 'approved', 'declined'])
export const enrollmentStatus = pgEnum("enrollment_status", ['active', 'transferred', 'departed', 'graduated'])
export const exportFormat = pgEnum("export_format", ['xlsx', 'csv'])
export const importKind = pgEnum("import_kind", ['students', 'teachers', 'assignments'])
export const importRowStatus = pgEnum("import_row_status", ['ok', 'warning', 'error'])
export const importStatus = pgEnum("import_status", ['previewing', 'applied', 'discarded'])
export const localeCode = pgEnum("locale_code", ['hy', 'en', 'ru'])
export const markState = pgEnum("mark_state", ['draft', 'published', 'superseded'])
export const supportKind = pgEnum("support_kind", ['contact', 'problem', 'feedback'])
export const userRole = pgEnum("user_role", ['student', 'teacher', 'admin'])


export const institution = pgTable("institution", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	emisId: text("emis_id"),
	region: text().notNull(),
	type: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
});

export const academicYear = pgTable("academic_year", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	institutionId: uuid("institution_id").notNull(),
	label: text().notNull(),
	startsOn: date("starts_on").notNull(),
	endsOn: date("ends_on").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.institutionId],
			foreignColumns: [institution.id],
			name: "academic_year_institution_id_fkey"
		}).onDelete("cascade"),
	check("academic_year_check", sql`ends_on > starts_on`),
]);

export const term = pgTable("term", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	academicYearId: uuid("academic_year_id").notNull(),
	index: smallint().notNull(),
	label: text().notNull(),
	startsOn: date("starts_on").notNull(),
	endsOn: date("ends_on").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.academicYearId],
			foreignColumns: [academicYear.id],
			name: "term_academic_year_id_fkey"
		}).onDelete("cascade"),
	unique("term_academic_year_id_index_key").on(table.academicYearId, table.index),
	check("term_check", sql`ends_on > starts_on`),
]);

export const schoolClass = pgTable("class", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	institutionId: uuid("institution_id").notNull(),
	academicYearId: uuid("academic_year_id").notNull(),
	grade: smallint().notNull(),
	letter: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.institutionId],
			foreignColumns: [institution.id],
			name: "class_institution_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.academicYearId],
			foreignColumns: [academicYear.id],
			name: "class_academic_year_id_fkey"
		}).onDelete("cascade"),
	unique("class_academic_year_id_grade_letter_key").on(table.academicYearId, table.grade, table.letter),
	check("class_grade_check", sql`(grade >= 1) AND (grade <= 12)`),
]);

export const subject = pgTable("subject", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	institutionId: uuid("institution_id").notNull(),
	nameHy: text("name_hy").notNull(),
	nameEn: text("name_en").notNull(),
	nameRu: text("name_ru").notNull(),
	code: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.institutionId],
			foreignColumns: [institution.id],
			name: "subject_institution_id_fkey"
		}).onDelete("cascade"),
]);

export const user = pgTable("user", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: citext("email").notNull(),
	passwordHash: text("password_hash").notNull(),
	role: userRole().notNull(),
	locale: localeCode().default('hy').notNull(),
	mustChangePassword: boolean("must_change_password").default(true).notNull(),
	isDemo: boolean("is_demo").default(false).notNull(),
	lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: 'string' }),
	lockedUntil: timestamp("locked_until", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	unique("user_email_key").on(table.email),
]);

export const student = pgTable("student", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	institutionId: uuid("institution_id").notNull(),
	emisStudentId: text("emis_student_id"),
	firstName: text("first_name").notNull(),
	lastName: text("last_name").notNull(),
	patronymic: text(),
	birthDate: date("birth_date"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_student_institution").using("btree", table.institutionId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "student_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.institutionId],
			foreignColumns: [institution.id],
			name: "student_institution_id_fkey"
		}).onDelete("cascade"),
	unique("student_user_id_key").on(table.userId),
]);

export const teacher = pgTable("teacher", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	institutionId: uuid("institution_id").notNull(),
	emisTeacherId: text("emis_teacher_id"),
	firstName: text("first_name").notNull(),
	lastName: text("last_name").notNull(),
	patronymic: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "teacher_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.institutionId],
			foreignColumns: [institution.id],
			name: "teacher_institution_id_fkey"
		}).onDelete("cascade"),
	unique("teacher_user_id_key").on(table.userId),
]);

export const enrollment = pgTable("enrollment", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	studentId: uuid("student_id").notNull(),
	classId: uuid("class_id").notNull(),
	academicYearId: uuid("academic_year_id").notNull(),
	status: enrollmentStatus().default('active').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_enrollment_class").using("btree", table.classId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.studentId],
			foreignColumns: [student.id],
			name: "enrollment_student_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.classId],
			foreignColumns: [schoolClass.id],
			name: "enrollment_class_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.academicYearId],
			foreignColumns: [academicYear.id],
			name: "enrollment_academic_year_id_fkey"
		}).onDelete("cascade"),
	unique("enrollment_student_id_academic_year_id_key").on(table.studentId, table.academicYearId),
]);

export const teachingAssignment = pgTable("teaching_assignment", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	teacherId: uuid("teacher_id").notNull(),
	classId: uuid("class_id").notNull(),
	subjectId: uuid("subject_id").notNull(),
	academicYearId: uuid("academic_year_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_ta_teacher").using("btree", table.teacherId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.teacherId],
			foreignColumns: [teacher.id],
			name: "teaching_assignment_teacher_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.classId],
			foreignColumns: [schoolClass.id],
			name: "teaching_assignment_class_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.subjectId],
			foreignColumns: [subject.id],
			name: "teaching_assignment_subject_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.academicYearId],
			foreignColumns: [academicYear.id],
			name: "teaching_assignment_academic_year_id_fkey"
		}).onDelete("cascade"),
	unique("teaching_assignment_class_id_subject_id_academic_year_id_key").on(table.classId, table.subjectId, table.academicYearId),
]);

export const assessment = pgTable("assessment", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	classId: uuid("class_id").notNull(),
	subjectId: uuid("subject_id").notNull(),
	termId: uuid("term_id").notNull(),
	heldOn: date("held_on").notNull(),
	kind: assessmentKind().notNull(),
	title: text(),
	topic: text(),
	createdByTeacherId: uuid("created_by_teacher_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_assessment_class").using("btree", table.classId.asc().nullsLast().op("uuid_ops"), table.subjectId.asc().nullsLast().op("uuid_ops"), table.termId.asc().nullsLast().op("uuid_ops")),
	index("idx_assessment_held_on").using("btree", table.heldOn.asc().nullsLast().op("date_ops")),
	foreignKey({
			columns: [table.classId],
			foreignColumns: [schoolClass.id],
			name: "assessment_class_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.subjectId],
			foreignColumns: [subject.id],
			name: "assessment_subject_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.termId],
			foreignColumns: [term.id],
			name: "assessment_term_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdByTeacherId],
			foreignColumns: [teacher.id],
			name: "assessment_created_by_teacher_id_fkey"
		}),
]);

export const mark = pgTable("mark", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	assessmentId: uuid("assessment_id").notNull(),
	studentId: uuid("student_id").notNull(),
	value: smallint().notNull(),
	state: markState().notNull(),
	supersedesMarkId: uuid("supersedes_mark_id"),
	reason: text(),
	enteredByTeacherId: uuid("entered_by_teacher_id").notNull(),
	enteredAt: timestamp("entered_at", { withTimezone: true, mode: 'string' }).notNull(),
	publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_mark_assessment").using("btree", table.assessmentId.asc().nullsLast().op("uuid_ops")),
	index("idx_mark_state").using("btree", table.state.asc().nullsLast().op("enum_ops")),
	index("idx_mark_student").using("btree", table.studentId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("one_current_mark").using("btree", table.assessmentId.asc().nullsLast().op("uuid_ops"), table.studentId.asc().nullsLast().op("uuid_ops")).where(sql`(state = ANY (ARRAY['draft'::mark_state, 'published'::mark_state]))`),
	foreignKey({
			columns: [table.assessmentId],
			foreignColumns: [assessment.id],
			name: "mark_assessment_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.studentId],
			foreignColumns: [student.id],
			name: "mark_student_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.supersedesMarkId],
			foreignColumns: [table.id],
			name: "mark_supersedes_mark_id_fkey"
		}),
	foreignKey({
			columns: [table.enteredByTeacherId],
			foreignColumns: [teacher.id],
			name: "mark_entered_by_teacher_id_fkey"
		}),
	check("mark_value_check", sql`(value >= 1) AND (value <= 10)`),
	check("reason_required_when_superseding", sql`(supersedes_mark_id IS NULL) OR (reason IS NOT NULL)`),
]);

export const importBatch = pgTable("import_batch", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	institutionId: uuid("institution_id").notNull(),
	actorUserId: uuid("actor_user_id").notNull(),
	kind: importKind().notNull(),
	filename: text().notNull(),
	rowCount: integer("row_count").default(0).notNull(),
	errorCount: integer("error_count").default(0).notNull(),
	status: importStatus().default('previewing').notNull(),
	appliedAt: timestamp("applied_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.institutionId],
			foreignColumns: [institution.id],
			name: "import_batch_institution_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.actorUserId],
			foreignColumns: [user.id],
			name: "import_batch_actor_user_id_fkey"
		}),
]);

export const importRow = pgTable("import_row", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	importBatchId: uuid("import_batch_id").notNull(),
	rowIndex: integer("row_index").notNull(),
	raw: jsonb().notNull(),
	status: importRowStatus().notNull(),
	message: text(),
	createdEntityId: uuid("created_entity_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.importBatchId],
			foreignColumns: [importBatch.id],
			name: "import_row_import_batch_id_fkey"
		}).onDelete("cascade"),
]);

export const exportLog = pgTable("export_log", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	institutionId: uuid("institution_id").notNull(),
	actorUserId: uuid("actor_user_id").notNull(),
	scope: jsonb().notNull(),
	format: exportFormat().notNull(),
	markCount: integer("mark_count").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.institutionId],
			foreignColumns: [institution.id],
			name: "export_log_institution_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.actorUserId],
			foreignColumns: [user.id],
			name: "export_log_actor_user_id_fkey"
		}),
]);

export const credentialRequest = pgTable("credential_request", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	studentId: uuid("student_id").notNull(),
	subjectId: uuid("subject_id"),
	category: text().notNull(),
	title: text().notNull(),
	description: text(),
	attachmentUrl: text("attachment_url"),
	attachmentMime: text("attachment_mime"),
	status: credentialStatus().default('pending').notNull(),
	decidedByUserId: uuid("decided_by_user_id"),
	decidedAt: timestamp("decided_at", { withTimezone: true, mode: 'string' }),
	decisionReason: text("decision_reason"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_credreq_status").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.studentId],
			foreignColumns: [student.id],
			name: "credential_request_student_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.subjectId],
			foreignColumns: [subject.id],
			name: "credential_request_subject_id_fkey"
		}),
	foreignKey({
			columns: [table.decidedByUserId],
			foreignColumns: [user.id],
			name: "credential_request_decided_by_user_id_fkey"
		}),
]);

export const qrCredential = pgTable("qr_credential", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	studentId: uuid("student_id").notNull(),
	seed: text().notNull(),
	issuedAt: timestamp("issued_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_qr_student").using("btree", table.studentId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.studentId],
			foreignColumns: [student.id],
			name: "qr_credential_student_id_fkey"
		}).onDelete("cascade"),
]);

export const scanEvent = pgTable("scan_event", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	qrCredentialId: uuid("qr_credential_id").notNull(),
	scannerId: text("scanner_id").notNull(),
	scannedAt: timestamp("scanned_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	result: text().notNull(),
	location: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.qrCredentialId],
			foreignColumns: [qrCredential.id],
			name: "scan_event_qr_credential_id_fkey"
		}).onDelete("cascade"),
]);

export const deviceSession = pgTable("device_session", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	deviceLabel: text("device_label").notNull(),
	refreshTokenHash: text("refresh_token_hash").notNull(),
	lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: 'string' }),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "device_session_user_id_fkey"
		}).onDelete("cascade"),
]);

export const notificationPref = pgTable("notification_pref", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	kind: text().notNull(),
	enabled: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "notification_pref_user_id_fkey"
		}).onDelete("cascade"),
	unique("notification_pref_user_id_kind_key").on(table.userId, table.kind),
]);

export const supportTicket = pgTable("support_ticket", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	kind: supportKind().notNull(),
	subject: text().notNull(),
	body: text().notNull(),
	rating: smallint(),
	context: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "support_ticket_user_id_fkey"
		}).onDelete("cascade"),
	check("support_ticket_rating_check", sql`(rating >= 1) AND (rating <= 5)`),
]);

export const auditLog = pgTable("audit_log", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	actorUserId: uuid("actor_user_id"),
	action: text().notNull(),
	entityType: text("entity_type").notNull(),
	entityId: uuid("entity_id"),
	before: jsonb(),
	after: jsonb(),
	ip: inet(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.actorUserId],
			foreignColumns: [user.id],
			name: "audit_log_actor_user_id_fkey"
		}),
]);

// Admissions applications (group B). Personal data about children who are
// NOT yet students of this school, which is a heavier obligation than
// anything else in this schema — see docs/decisions.md on Q7 and Q10, both
// of which block real use of this feature.
//
// `schoolChoice` is plain text on purpose: there is no `school` table and
// none is being created, so the choice is stored as the name that was
// offered, not as a foreign key. `status` is text rather than a new enum
// because the DDL handed over for review specified text; a check constraint
// carries the same guarantee.
export const application = pgTable("application", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	firstName: text("first_name").notNull(),
	lastName: text("last_name").notNull(),
	birthDate: date("birth_date").notNull(),
	email: text().notNull(),
	phone: text(),
	schoolChoice: text("school_choice").notNull(),
	streamChoice: text("stream_choice").notNull(),
	motivation: text(),
	transcriptKey: text("transcript_key"),
	status: text().default('pending').notNull(),
	decidedAt: timestamp("decided_at", { withTimezone: true, mode: 'string' }),
	decidedBy: uuid("decided_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.decidedBy],
			foreignColumns: [user.id],
			name: "application_decided_by_fkey"
		}),
	index("application_status_created_idx").on(table.status, table.createdAt.desc()),
	check("application_status_check", sql`status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])`),
]);
