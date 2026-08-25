import { relations } from "drizzle-orm/relations";
import { institution, academicYear, term, schoolClass, subject, user, student, teacher, enrollment, teachingAssignment, assessment, mark, importBatch, importRow, exportLog, credentialRequest, qrCredential, scanEvent, deviceSession, notificationPref, supportTicket, auditLog } from "./schema.js";

export const academicYearRelations = relations(academicYear, ({one, many}) => ({
	institution: one(institution, {
		fields: [academicYear.institutionId],
		references: [institution.id]
	}),
	terms: many(term),
	classes: many(schoolClass),
	enrollments: many(enrollment),
	teachingAssignments: many(teachingAssignment),
}));

export const institutionRelations = relations(institution, ({many}) => ({
	academicYears: many(academicYear),
	classes: many(schoolClass),
	subjects: many(subject),
	students: many(student),
	teachers: many(teacher),
	importBatches: many(importBatch),
	exportLogs: many(exportLog),
}));

export const termRelations = relations(term, ({one, many}) => ({
	academicYear: one(academicYear, {
		fields: [term.academicYearId],
		references: [academicYear.id]
	}),
	assessments: many(assessment),
}));

export const classRelations = relations(schoolClass, ({one, many}) => ({
	institution: one(institution, {
		fields: [schoolClass.institutionId],
		references: [institution.id]
	}),
	academicYear: one(academicYear, {
		fields: [schoolClass.academicYearId],
		references: [academicYear.id]
	}),
	enrollments: many(enrollment),
	teachingAssignments: many(teachingAssignment),
	assessments: many(assessment),
}));

export const subjectRelations = relations(subject, ({one, many}) => ({
	institution: one(institution, {
		fields: [subject.institutionId],
		references: [institution.id]
	}),
	teachingAssignments: many(teachingAssignment),
	assessments: many(assessment),
	credentialRequests: many(credentialRequest),
}));

export const studentRelations = relations(student, ({one, many}) => ({
	user: one(user, {
		fields: [student.userId],
		references: [user.id]
	}),
	institution: one(institution, {
		fields: [student.institutionId],
		references: [institution.id]
	}),
	enrollments: many(enrollment),
	marks: many(mark),
	credentialRequests: many(credentialRequest),
	qrCredentials: many(qrCredential),
}));

export const userRelations = relations(user, ({many}) => ({
	students: many(student),
	teachers: many(teacher),
	importBatches: many(importBatch),
	exportLogs: many(exportLog),
	credentialRequests: many(credentialRequest),
	deviceSessions: many(deviceSession),
	notificationPrefs: many(notificationPref),
	supportTickets: many(supportTicket),
	auditLogs: many(auditLog),
}));

export const teacherRelations = relations(teacher, ({one, many}) => ({
	user: one(user, {
		fields: [teacher.userId],
		references: [user.id]
	}),
	institution: one(institution, {
		fields: [teacher.institutionId],
		references: [institution.id]
	}),
	teachingAssignments: many(teachingAssignment),
	assessments: many(assessment),
	marks: many(mark),
}));

export const enrollmentRelations = relations(enrollment, ({one}) => ({
	student: one(student, {
		fields: [enrollment.studentId],
		references: [student.id]
	}),
	class: one(schoolClass, {
		fields: [enrollment.classId],
		references: [schoolClass.id]
	}),
	academicYear: one(academicYear, {
		fields: [enrollment.academicYearId],
		references: [academicYear.id]
	}),
}));

export const teachingAssignmentRelations = relations(teachingAssignment, ({one}) => ({
	teacher: one(teacher, {
		fields: [teachingAssignment.teacherId],
		references: [teacher.id]
	}),
	class: one(schoolClass, {
		fields: [teachingAssignment.classId],
		references: [schoolClass.id]
	}),
	subject: one(subject, {
		fields: [teachingAssignment.subjectId],
		references: [subject.id]
	}),
	academicYear: one(academicYear, {
		fields: [teachingAssignment.academicYearId],
		references: [academicYear.id]
	}),
}));

export const assessmentRelations = relations(assessment, ({one, many}) => ({
	class: one(schoolClass, {
		fields: [assessment.classId],
		references: [schoolClass.id]
	}),
	subject: one(subject, {
		fields: [assessment.subjectId],
		references: [subject.id]
	}),
	term: one(term, {
		fields: [assessment.termId],
		references: [term.id]
	}),
	teacher: one(teacher, {
		fields: [assessment.createdByTeacherId],
		references: [teacher.id]
	}),
	marks: many(mark),
}));

export const markRelations = relations(mark, ({one, many}) => ({
	assessment: one(assessment, {
		fields: [mark.assessmentId],
		references: [assessment.id]
	}),
	student: one(student, {
		fields: [mark.studentId],
		references: [student.id]
	}),
	mark: one(mark, {
		fields: [mark.supersedesMarkId],
		references: [mark.id],
		relationName: "mark_supersedesMarkId_mark_id"
	}),
	marks: many(mark, {
		relationName: "mark_supersedesMarkId_mark_id"
	}),
	teacher: one(teacher, {
		fields: [mark.enteredByTeacherId],
		references: [teacher.id]
	}),
}));

export const importBatchRelations = relations(importBatch, ({one, many}) => ({
	institution: one(institution, {
		fields: [importBatch.institutionId],
		references: [institution.id]
	}),
	user: one(user, {
		fields: [importBatch.actorUserId],
		references: [user.id]
	}),
	importRows: many(importRow),
}));

export const importRowRelations = relations(importRow, ({one}) => ({
	importBatch: one(importBatch, {
		fields: [importRow.importBatchId],
		references: [importBatch.id]
	}),
}));

export const exportLogRelations = relations(exportLog, ({one}) => ({
	institution: one(institution, {
		fields: [exportLog.institutionId],
		references: [institution.id]
	}),
	user: one(user, {
		fields: [exportLog.actorUserId],
		references: [user.id]
	}),
}));

export const credentialRequestRelations = relations(credentialRequest, ({one}) => ({
	student: one(student, {
		fields: [credentialRequest.studentId],
		references: [student.id]
	}),
	subject: one(subject, {
		fields: [credentialRequest.subjectId],
		references: [subject.id]
	}),
	user: one(user, {
		fields: [credentialRequest.decidedByUserId],
		references: [user.id]
	}),
}));

export const qrCredentialRelations = relations(qrCredential, ({one, many}) => ({
	student: one(student, {
		fields: [qrCredential.studentId],
		references: [student.id]
	}),
	scanEvents: many(scanEvent),
}));

export const scanEventRelations = relations(scanEvent, ({one}) => ({
	qrCredential: one(qrCredential, {
		fields: [scanEvent.qrCredentialId],
		references: [qrCredential.id]
	}),
}));

export const deviceSessionRelations = relations(deviceSession, ({one}) => ({
	user: one(user, {
		fields: [deviceSession.userId],
		references: [user.id]
	}),
}));

export const notificationPrefRelations = relations(notificationPref, ({one}) => ({
	user: one(user, {
		fields: [notificationPref.userId],
		references: [user.id]
	}),
}));

export const supportTicketRelations = relations(supportTicket, ({one}) => ({
	user: one(user, {
		fields: [supportTicket.userId],
		references: [user.id]
	}),
}));

export const auditLogRelations = relations(auditLog, ({one}) => ({
	user: one(user, {
		fields: [auditLog.actorUserId],
		references: [user.id]
	}),
}));