import {attachSavedLessonViewer} from '/board-assets/board.js';
const root=document.getElementById('saved-lesson-viewer');
attachSavedLessonViewer(root,JSON.parse(root.dataset.scene));
