const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcrypt");
require("dotenv").config();
const nodemailer = require("nodemailer");
const app = express();
const PORT = process.env.PORT || 5000;

const frontendPath = path.join(__dirname, "../frontend");

app.use(cors());
app.use(express.json());
app.use(express.static(frontendPath));

mongoose.connect('mongodb+srv://thrishakandi4_db_user:3shakandi%402004@cluster0.w7ay0q1.mongodb.net/STS?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});
const User = mongoose.model("User", userSchema);

const studentSchema = new mongoose.Schema({
  studentid: { type: String, required: true, unique: true },
  studentname: { type: String, required: true },
  parentemail: { type: String, required: true },
  mid1: { type: String, default: "" },
  mid2: { type: String, default: "" },
  semester: { type: String, default: "" },
  mid1status: { type: String, default: "Not Available" },
  mid2status: { type: String, default: "Not Available" },
  semesterstatus: { type: String, default: "Not Available" },
  credits: { type: Number, default: 0 },
  recentActivities: [{ type: String }]
});
const Student = mongoose.model("Student", studentSchema);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.error("SMTP connection error:", error);
  } else {
    console.log("SMTP Server is ready to send emails");
  }
});

async function sendStudentUpdateEmail(student) {
  if (!student.parentemail) return;

  const mailOptions = {
    from: '"Student Tracking System" <abhisheshkandi31@gmail.com>',
    to: student.parentemail,
    subject: `Update on your performance, ${student.studentname}`,
    text: `Hello ${student.studentname},

Here is your latest academic performance update:

Credits Earned: ${student.credits}
Recent Activities:
${student.recentActivities.length ? student.recentActivities.join("\n") : "No recent activities."}

Keep up the good work!

Regards,
Student Tracking System`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${student.parentemail}`);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

// Routes

app.post("/api/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ error: "All fields required." });

    const exists = await User.findOne({ $or: [{ username }, { email }] });
    if (exists) return res.status(400).json({ error: "User exists." });

    const hashed = await bcrypt.hash(password, 10);
    await new User({ username, email, password: hashed }).save();
    res.status(201).json({ message: "User registered." });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Server error." });
  }
});

app.post("/addstudent", async (req, res) => {
  try {
    const { studentid, studentname, parentemail, mid1, mid2, semester, credits } = req.body;

    if (!studentid || !studentname || !parentemail) {
      return res.status(400).json({ message: "Student ID, Name, and Parent Email are required." });
    }

    const exists = await Student.findOne({ studentid });
    if (exists) {
      return res.status(400).json({ message: "Student with this ID already exists." });
    }

    const newStudent = new Student({
      studentid,
      studentname,
      parentemail,
      mid1: mid1 || "",
      mid2: mid2 || "",
      semester: semester || "",
      credits: credits || 0,
    });

    await newStudent.save();

    res.status(201).json({ message: "Student added successfully." });
  } catch (err) {
    console.error("Add student error:", err);
    res.status(500).json({ message: "Server error while adding student." });
  }
});

app.get("/studentdetails", async (req, res) => {
  try {
    const students = await Student.find({});
    res.json(students);
  } catch (error) {
    console.error("Error fetching students:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.patch("/updatestudent/:id", async (req, res) => {
  const { id } = req.params;
  const { mid1, mid2, semester } = req.body;

  try {
    const student = await Student.findById(id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    if (mid1 !== undefined) student.mid1 = mid1;
    if (mid2 !== undefined) student.mid2 = mid2;
    if (semester !== undefined) student.semester = semester;

    const fullMid1 = 20, creditMid1 = 50;
    const fullMid2 = 20, creditMid2 = 50;
    const fullSemester = 60, creditSemester = 100;

    let earned = 0;
    let totalCredits = 0;

    if (student.mid1 !== "" && !isNaN(parseFloat(student.mid1))) {
      const m1 = parseFloat(student.mid1);
      earned += (m1 / fullMid1) * creditMid1;
      totalCredits += creditMid1;
      student.mid1status = m1 >= 16 ? "Good" : m1 >= 10 ? "Average" : "Poor";
    }

    if (student.mid2 !== "" && !isNaN(parseFloat(student.mid2))) {
      const m2 = parseFloat(student.mid2);
      earned += (m2 / fullMid2) * creditMid2;
      totalCredits += creditMid2;
      student.mid2status = m2 >= 16 ? "Good" : m2 >= 10 ? "Average" : "Poor";
    }

    if (student.semester !== "" && !isNaN(parseFloat(student.semester))) {
      const sem = parseFloat(student.semester);
      earned += (sem / fullSemester) * creditSemester;
      totalCredits += creditSemester;
      student.semesterstatus = sem >= 48 ? "Good" : sem >= 30 ? "Average" : "Poor";
    }

    const finalCredits = Math.round(earned);
    student.credits = finalCredits;

    let newActivities = [];

    if (mid1 !== undefined) {
      const score = parseFloat(mid1);
      if (!isNaN(score)) {
        if (score >= 16) newActivities.push(`${student.studentname} performed excellently in Mid 1.`);
        else if (score >= 10) newActivities.push(`${student.studentname} had an average performance in Mid 1.`);
        else newActivities.push(`${student.studentname} needs improvement in Mid 1.`);
      }
    }

    if (mid2 !== undefined) {
      const score = parseFloat(mid2);
      if (!isNaN(score)) {
        if (score >= 16) newActivities.push(`${student.studentname} did great in Mid 2.`);
        else if (score >= 10) newActivities.push(`${student.studentname} did okay in Mid 2.`);
        else newActivities.push(`${student.studentname} underperformed in Mid 2.`);
      }
    }

    if (semester !== undefined) {
      const score = parseFloat(semester);
      if (!isNaN(score)) {
        if (score >= 48) newActivities.push(`${student.studentname} scored excellently in the Semester exam.`);
        else if (score >= 30) newActivities.push(`${student.studentname} had an average Semester exam.`);
        else newActivities.push(`${student.studentname} struggled in the Semester exam.`);
      }
    }

    student.recentActivities = [...newActivities, ...student.recentActivities].slice(0, 5);

    await student.save();

    res.json({ message: "Student updated successfully", student });
  } catch (error) {
    console.error("Update error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/recentactivities", async (req, res) => {
  try {
    const students = await Student.find({}, "studentname recentActivities");
    const allActivities = students.flatMap(s => s.recentActivities);
    res.json(allActivities.slice(0, 10));
  } catch (err) {
    console.error("Error getting recent activities:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.delete("/deletestudent/:id", async (req, res) => {
  try {
    await Student.findByIdAndDelete(req.params.id);
    res.json({ message: "Student deleted." });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete student." });
  }
});

app.delete("/deleteallstudents", async (req, res) => {
  try {
    await Student.deleteMany({});
    res.json({ message: "All students deleted." });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete all students." });
  }
});

app.post("/teacherlog", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password.Please SignIn First" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid email or password.Please SignIn First" });
    }

    return res.json({ message: "Login successful" });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

app.get('/teacherlog', (req, res) => {
  res.sendFile(path.join(frontendPath, 'teacherlog.html'));
});

app.get('/totalstudents', async (req, res) => {
  try {
    const count = await Student.countDocuments();
    res.json({ total: count });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/studentsatRisk', async (req, res) => {
  try {
    const count = await Student.countDocuments({
      $or: [
        { mid1: { $lt: 10 } },
        { credits: { $lt: 25 } }
      ]
    });
    res.json({ atRisk: count });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/notattempted", async (req, res) => {
  try {
    const exam = req.query.exam;

    if (!exam || !["mid1", "mid2", "semester"].includes(exam.toLowerCase())) {
      return res.status(400).json({ message: "Invalid exam parameter" });
    }

    const examField = exam.toLowerCase();
    const statusField = `${examField}status`;

    const notAttemptedStudents = await Student.find({
      $or: [
        { [examField]: "" },
        { [examField]: null },
        { [examField]: { $exists: false } },
        { [statusField]: "Not Available" },
        { [statusField]: "" },
        { [statusField]: null },
        { [statusField]: { $exists: false } }
      ],
    });

    res.json({ count: notAttemptedStudents.length });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/sendparentemail", async (req, res) => {
  const { to, subject, message } = req.body;

  if (!to || !subject || !message) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const mailOptions = {
    from: '"Student Tracking System" <abhisheshkandi31@gmail.com>',
    to,
    subject,
    html: message,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to}`);
    res.status(200).json({ message: "Email sent successfully!" });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ message: "Failed to send email" });
  }
});

app.post("/studentlogin", async (req, res) => {
  try {
    const { studentid, parentemail } = req.body;

    if (!studentid || !parentemail) {
      return res.status(400).json({ message: "Student ID and Parent Email are required." });
    }

    const student = await Student.findOne({ studentid, parentemail });
    if (!student) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    return res.json({ message: "Login successful", student });
  } catch (err) {
    console.error("Student login error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
