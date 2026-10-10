# School Database Design

## Tables

- **students** stores each student's ID, first name, last name, and unique email address.
- **courses** stores each course's ID, unique name, and credit value.
- **enrolments** records a student's registration on a course and the grade earned. Its student and course IDs are foreign keys, and each grade must be between 0 and 100.

## Relationships

One student can have many enrolments, and one course can have many enrolments; each individual enrolment refers to exactly one student and one course. This means students and courses have a many-to-many relationship: a student can take multiple courses, and a course can have multiple students. The enrolments join table represents each pairing, stores its grade, and prevents the same student from enrolling in the same course twice with a unique constraint on `(student_id, course_id)`.

## Index

I would add an index on `enrolments.course_id` to speed up finding students in a course and counting enrolments by course. The unique constraint on `(student_id, course_id)` already supports searches starting with `student_id`, but does not efficiently index searches by `course_id` alone.

```sql
CREATE INDEX idx_enrolments_course_id ON enrolments (course_id);
```

## SQL or NoSQL?

I would choose SQL for this system. Students, courses, and enrolments have clear relationships and integrity rules, and the reports need joins and grouped counts. A relational database can enforce unique emails, valid foreign keys, and one enrolment per student-course pair, while transactions keep related changes consistent. Those guarantees and query patterns fit this structured school data better than a NoSQL database.