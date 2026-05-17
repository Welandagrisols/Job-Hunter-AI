export const theme = {
  colors: {
    // Dark background palette
    bg: {
      primary: "#0A0F1E",
      secondary: "#111827",
      card: "#1A2236",
      elevated: "#1F2D45",
      border: "#2A3A55",
    },
    // Accent colors
    accent: {
      cyan: "#00D4FF",
      cyanDim: "#00D4FF22",
      green: "#00FF88",
      greenDim: "#00FF8822",
      orange: "#FF8C42",
      orangeDim: "#FF8C4222",
      red: "#FF4757",
      redDim: "#FF475722",
      purple: "#8B5CF6",
      purpleDim: "#8B5CF622",
      gold: "#FFD700",
    },
    // Text
    text: {
      primary: "#F0F4FF",
      secondary: "#8899BB",
      muted: "#4A5A7A",
      inverse: "#0A0F1E",
    },
    // Status colors
    status: {
      applied: "#00D4FF",
      interview: "#00FF88",
      offer: "#FFD700",
      rejected: "#FF4757",
      withdrawn: "#8899BB",
      waiting: "#FF8C42",
    },
  },

  // Status label map
  statusLabels: {
    applied: "Applied",
    interview: "Interview",
    offer: "Offer",
    rejected: "Rejected",
    withdrawn: "Withdrawn",
    waiting: "Waiting",
  },

  // Classification colors
  classificationColors: {
    interview_invite: "#00FF88",
    offer: "#FFD700",
    rejection: "#FF4757",
    assessment: "#8B5CF6",
    follow_up: "#FF8C42",
    other: "#00D4FF",
  },

  classificationLabels: {
    interview_invite: "Interview Invite 🎉",
    offer: "Job Offer 🏆",
    rejection: "Rejection",
    assessment: "Assessment 📝",
    follow_up: "Follow Up",
    other: "Recruiter Email",
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 999,
  },

  font: {
    sizes: {
      xs: 11,
      sm: 13,
      md: 15,
      lg: 17,
      xl: 20,
      xxl: 24,
      xxxl: 32,
    },
    weights: {
      regular: "400" as const,
      medium: "500" as const,
      semibold: "600" as const,
      bold: "700" as const,
      extrabold: "800" as const,
    },
  },
};
