export interface TemplateColumn {
  title: string;
  color: string;
}

export interface BoardTemplate {
  id: string;
  title: string;
  color: string;
  columns: TemplateColumn[];
}

export const TEMPLATES: BoardTemplate[] = [
  { 
    id: '1', 
    title: '1-on-1 Meeting Agenda', 
    color: '#8b5a2b',
    columns: [
      { title: 'To Discuss', color: '#0052CC' },
      { title: 'Ongoing Items', color: '#FF991F' },
      { title: 'Action Items', color: '#36B37E' }
    ]
  },
  { 
    id: '2', 
    title: 'Agile Board Template | Kordit', 
    color: '#ff7f50',
    columns: [
      { title: 'Backlog', color: '#172B4D' },
      { title: 'Sprints', color: '#0052CC' },
      { title: 'In Progress', color: '#FF991F' },
      { title: 'Review', color: '#6554C0' },
      { title: 'Done', color: '#36B37E' }
    ]
  },
  { 
    id: '3', 
    title: 'Company Overview', 
    color: '#87ceeb',
    columns: [
      { title: 'Company Goals', color: '#0052CC' },
      { title: 'Department Updates', color: '#6554C0' },
      { title: 'Resources', color: '#36B37E' }
    ]
  },
  { 
    id: '4', 
    title: 'Design Huddle', 
    color: '#ff69b4',
    columns: [
      { title: 'Inspiration', color: '#FF5630' },
      { title: 'In Progress', color: '#FF991F' },
      { title: 'Feedback Needed', color: '#6554C0' },
      { title: 'Approved', color: '#36B37E' }
    ]
  },
  { 
    id: '5', 
    title: 'Go To Market Strategy Template', 
    color: '#00ced1',
    columns: [
      { title: 'Market Research', color: '#0052CC' },
      { title: 'Target Audience', color: '#6554C0' },
      { title: 'Messaging', color: '#FF991F' },
      { title: 'Launch Plan', color: '#36B37E' }
    ]
  },
  { 
    id: '6', 
    title: 'Mise-En-Place Personal Productivity', 
    color: '#556b2f',
    columns: [
      { title: 'Inbox', color: '#172B4D' },
      { title: 'Today', color: '#FF5630' },
      { title: 'This Week', color: '#FF991F' },
      { title: 'Later', color: '#0052CC' }
    ]
  },
  { 
    id: '7', 
    title: 'Project Management', 
    color: '#9370db',
    columns: [
      { title: 'To Do', color: '#0052CC' },
      { title: 'In Progress', color: '#FF991F' },
      { title: 'Blocked', color: '#FF5630' },
      { title: 'Done', color: '#36B37E' }
    ]
  },
  { 
    id: '8', 
    title: 'Remote Team Meetings', 
    color: '#e6e6fa',
    columns: [
      { title: 'Agenda', color: '#0052CC' },
      { title: 'Discussion', color: '#FF991F' },
      { title: 'Decisions', color: '#6554C0' },
      { title: 'Follow-ups', color: '#36B37E' }
    ]
  },
  { 
    id: '9', 
    title: 'Simple Project Board', 
    color: '#32cd32',
    columns: [
      { title: 'To Do', color: '#0052CC' },
      { title: 'Doing', color: '#FF991F' },
      { title: 'Done', color: '#36B37E' }
    ]
  },
  { 
    id: '10', 
    title: 'Teaching: Weekly Planning', 
    color: '#ffa07a',
    columns: [
      { title: 'Monday', color: '#0052CC' },
      { title: 'Tuesday', color: '#0052CC' },
      { title: 'Wednesday', color: '#0052CC' },
      { title: 'Thursday', color: '#0052CC' },
      { title: 'Friday', color: '#0052CC' }
    ]
  },
];
