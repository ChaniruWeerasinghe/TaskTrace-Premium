// Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyCqkHZS8b0aM6NsDFBMTycXAOH7IX83p34",
    authDomain: "tasktrace-todo.firebaseapp.com",
    databaseURL: "https://tasktrace-todo-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "tasktrace-todo",
    storageBucket: "tasktrace-todo.firebasestorage.app",
    messagingSenderId: "973460692114",
    appId: "1:973460692114:web:267859507b6cb818055a4b"
};

// Initialize Firebase
let database;
let db;
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
database = firebase.database();
db = firebase.firestore();
const auth = firebase.auth();
