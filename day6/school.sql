PRAGMA foreign_keys = ON;

CREATE TABLE students (
  student_id INTEGER PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE
);

CREATE TABLE courses (
  course_id INTEGER PRIMARY KEY,
  course_name TEXT NOT NULL UNIQUE,
  credits INTEGER NOT NULL CHECK (credits > 0)
);

CREATE TABLE enrolments (
  enrolment_id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  grade INTEGER NOT NULL CHECK (grade BETWEEN 0 AND 100),
  CONSTRAINT fk_enrolments_student
    FOREIGN KEY (student_id) REFERENCES students (student_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_enrolments_course
    FOREIGN KEY (course_id) REFERENCES courses (course_id)
    ON DELETE CASCADE,
  CONSTRAINT uq_student_course UNIQUE (student_id, course_id)
);

INSERT INTO students (student_id, first_name, last_name, email) VALUES
  (1, 'Ava', 'Patel', 'ava.patel@example.edu'),
  (2, 'Liam', 'Chen', 'liam.chen@example.edu'),
  (3, 'Maya', 'Garcia', 'maya.garcia@example.edu'),
  (4, 'Theo', 'Morgan', 'theo.morgan@example.edu');

INSERT INTO courses (course_id, course_name, credits) VALUES
  (1, 'Web Development', 3),
  (2, 'Database Design', 4),
  (3, 'Digital Art', 2);

INSERT INTO enrolments (enrolment_id, student_id, course_id, grade) VALUES
  (1, 1, 1, 88),
  (2, 1, 2, 91),
  (3, 2, 1, 78),
  (4, 2, 2, 84),
  (5, 3, 2, 93);

-- 1. All courses for one student, selected by name.
SELECT c.course_name, c.credits, e.grade
FROM students AS s
JOIN enrolments AS e ON e.student_id = s.student_id
JOIN courses AS c ON c.course_id = e.course_id
WHERE s.first_name = 'Ava' AND s.last_name = 'Patel'
ORDER BY c.course_name;

-- 2. All students enrolled on one course.
SELECT s.first_name, s.last_name, s.email, e.grade
FROM courses AS c
JOIN enrolments AS e ON e.course_id = c.course_id
JOIN students AS s ON s.student_id = e.student_id
WHERE c.course_name = 'Database Design'
ORDER BY s.last_name, s.first_name;

-- 3. Number of students per course, including courses with no enrolments.
SELECT c.course_name, COUNT(e.student_id) AS student_count
FROM courses AS c
LEFT JOIN enrolments AS e ON e.course_id = c.course_id
GROUP BY c.course_id, c.course_name
ORDER BY c.course_name;

-- 4. Students who have no enrolments.
SELECT s.first_name, s.last_name, s.email
FROM students AS s
LEFT JOIN enrolments AS e ON e.student_id = s.student_id
WHERE e.student_id IS NULL
ORDER BY s.last_name, s.first_name;

-- 5. Update Ava Patel's grade in Web Development.
UPDATE enrolments
SET grade = 90
WHERE student_id = (
  SELECT student_id
  FROM students
  WHERE email = 'ava.patel@example.edu'
)
AND course_id = (
  SELECT course_id
  FROM courses
  WHERE course_name = 'Web Development'
);