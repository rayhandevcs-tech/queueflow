import type { Dict } from "@/lib/i18n";

export const providerAppointmentsDict = {
  // ---- Today ----
  greeting: { bn: "আজকের হিসাব", en: "Today at a glance" },
  todayDate: {
    bn: (date: string) => `আজ ${date}`,
    en: (date: string) => `Today, ${date}`,
  },
  // One `chairs` row is one seat and the beautician who works it, so counting
  // them separately would print the same number twice.
  seatsTile: { bn: "সিট ও বিউটিশিয়ান", en: "Seats & staff" },
  activeSeatsTile: { bn: "আজ চালু", en: "On today" },
  servicesTile: { bn: "সার্ভিস", en: "Services" },
  appointmentsTile: { bn: "আজকের অ্যাপয়েন্টমেন্ট", en: "Today's appointments" },

  // ---- The day board ----
  boardTitle: { bn: "আজকের সময়সূচি", en: "Today's schedule" },
  boardHours: {
    bn: (open: string, close: string) => `${open} – ${close}`,
    en: (open: string, close: string) => `${open} – ${close}`,
  },
  boardLoadFailed: {
    bn: "সময়সূচি আনা গেল না। একটু পরে আবার চেষ্টা করো।",
    en: "Couldn't load the schedule. Try again in a moment.",
  },
  boardNoStaffTitle: {
    bn: (staff: string) => `এখনো কোনো ${staff} যোগ করা হয়নি`,
    en: (staff: string) => `No ${staff.toLowerCase()} yet`,
  },
  boardNoStaffDesc: {
    bn: "সময়সূচির প্রতিটা কলাম একজন করে — অন্তত একজন যোগ করলে বোর্ড আঁকা শুরু হবে।",
    en: "Each column of the schedule is one of them — add at least one and the board starts drawing.",
  },
  boardNoStaffCta: { bn: "যোগ করো", en: "Add one" },
  boardClosedTitle: { bn: "আজ দোকান বন্ধ", en: "Closed today" },
  boardClosedDesc: {
    bn: "সাপ্তাহিক সময়সূচি অনুযায়ী আজ বন্ধ, তাই আজকের কোনো গ্রিড নেই।",
    en: "Your weekly hours say you're shut today, so there's no grid to draw.",
  },
  boardNoHoursTitle: { bn: "খোলার সময় এখনো সেট করা হয়নি", en: "Opening hours aren't set" },
  boardNoHoursDesc: {
    bn: "দিনের গ্রিড তোমার খোলা-বন্ধের সময় ধরে আঁকা হয়। সেটিংসে সময় বসালেই সময়সূচি দেখা যাবে।",
    en: "The day grid is drawn from your opening and closing times. Set them and the schedule appears.",
  },
  boardHoursCta: { bn: "সময় সেট করো", en: "Set your hours" },
  boardEmptyDay: { bn: "আজ কোনো অ্যাপয়েন্টমেন্ট নেই", en: "No appointments today" },
  boardNotLiveNote: {
    bn: "কাস্টমাররা তোমার পাতা থেকে সময় বেছে বুক করলে সেগুলো এখানেই বসবে।",
    en: "When customers pick a time on your page, their bookings appear here.",
  },
  // ---- Detail sheet ----
  detailTitle: { bn: "অ্যাপয়েন্টমেন্টের বিস্তারিত", en: "Appointment details" },
  detailWhen: { bn: "সময়", en: "When" },
  detailServices: { bn: "সার্ভিস", en: "Services" },
  detailPrice: { bn: "দাম", en: "Price" },
  detailFinished: {
    bn: "এই অ্যাপয়েন্টমেন্টটা শেষ হয়ে গেছে — আর কিছু করার নেই।",
    en: "This appointment is finished — nothing left to do.",
  },
  noCustomerName: { bn: "নাম দেওয়া হয়নি", en: "No name given" },

  // ---- Appointment list (Sprint 5 hardening) ----
  listTitle: { bn: "অ্যাপয়েন্টমেন্টের খাতা", en: "Appointment register" },
  listSubtitle: {
    bn: "কে, কী সার্ভিস, কার কাছে, কোন দিন, কত টাকা — সব এক জায়গায়।",
    en: "Who, what service, with whom, on which day, for how much — all in one place.",
  },
  listScopeToday: { bn: "আজ", en: "Today" },
  listScopeUpcoming: { bn: "সামনে", en: "Upcoming" },
  listScopeCompleted: { bn: "শেষ হয়েছে", en: "Completed" },
  listScopeCancelled: { bn: "বাতিল ও আসেনি", en: "Cancelled & no-show" },
  listScopeAll: { bn: "সব", en: "All" },
  listAllStaff: { bn: "সবাই", en: "Everyone" },
  listFrom: { bn: "থেকে", en: "From" },
  listTo: { bn: "পর্যন্ত", en: "To" },
  listClearFilters: { bn: "ফিল্টার মুছো", en: "Clear" },
  listColCustomer: { bn: "কাস্টমার", en: "Customer" },
  listColServices: { bn: "সার্ভিস", en: "Service" },
  listColStaff: { bn: "কার কাছে", en: "With" },
  listColDate: { bn: "দিন", en: "Date" },
  listColStart: { bn: "শুরু", en: "Start" },
  listColEnd: { bn: "শেষ", en: "End" },
  listColPrice: { bn: "টাকা", en: "Price" },
  listColStatus: { bn: "অবস্থা", en: "Status" },
  listPaidTag: { bn: "টাকা পেয়েছ", en: "Paid" },
  listUnpaidTag: { bn: "বাকি", en: "Unpaid" },
  listEmptyTitle: { bn: "এই ফিল্টারে কিছু নেই", en: "Nothing matches these filters" },
  listEmptyBody: {
    bn: "অন্য ট্যাব বা অন্য দিন দেখো — অথবা ফিল্টার মুছে পুরো খাতা দেখো।",
    en: "Try another tab or another day — or clear the filters to see the whole register.",
  },
  listLoadFailed: {
    bn: "খাতা আনা গেল না। একটু পরে আবার চেষ্টা করো।",
    en: "Couldn't load the register. Try again in a moment.",
  },
  listQueueShopTitle: { bn: "এই দোকান সিরিয়ালে চলে", en: "This shop runs on a queue" },
  listQueueShopBody: {
    bn: "অ্যাপয়েন্টমেন্টের খাতা পার্লারের জন্য। তোমার দোকানের কাজের হিসাব সিরিয়াল বোর্ড আর আয়ের পাতায়।",
    en: "The appointment register is for parlours. Your shop's work is on the queue board and the income page.",
  },
  listQueueShopCta: { bn: "বোর্ডে ফিরে যাও", en: "Back to the board" },
  listCapped: {
    bn: (n: string) => `সবচেয়ে সাম্প্রতিক ${n}টা দেখানো হচ্ছে — আরো পুরনো দেখতে দিন বেছে নাও।`,
    en: (n: string) => `Showing the most recent ${n} — pick a date range to reach further back.`,
  },

  // ---- Payment on completion (Sprint 5 hardening) ----
  // Same wording as the queue's sheet, on purpose: one shop, one question.
  payAskTitle: { bn: "টাকা পেয়েছ?", en: "Did you get paid?" },
  payMethodTitle: { bn: "কীভাবে পেলে?", en: "How did they pay?" },
  payYesCta: { bn: "হ্যাঁ", en: "Yes" },
  payNoCta: { bn: "না", en: "No" },
  payBackCta: { bn: "ফিরে যাও", en: "Go back" },
  payCash: { bn: "নগদ টাকা", en: "Cash" },
  payBkash: { bn: "বিকাশ", en: "bKash" },
  payNagad: { bn: "নগদ", en: "Nagad" },
  payRocket: { bn: "রকেট", en: "Rocket" },
  payCard: { bn: "কার্ড", en: "Card" },

  // ---- Staff availability (Sprint 5) ----
  availabilityHeading: { bn: "কে কখন কাজ করে", en: "Who works when" },
  availabilityDesc: {
    bn: "দোকানের খোলার সময়ের ভেতরে প্রত্যেকের নিজের সময়। যে দিনের সময় দেওয়া নেই, সেদিন ওই বিউটিশিয়ানের কোনো স্লট দেখানো হবে না।",
    en: "Each person's own hours, inside the shop's. A day with no hours set means no slots are offered for them that day.",
  },
  availabilitySetDay: { bn: "এই দিনে কাজ করে", en: "Works this day" },
  availabilityDayOff: { bn: "ছুটির দিন", en: "Day off" },
  availabilityShopShut: { bn: "দোকান বন্ধ", en: "Shop shut" },
  availabilityClipped: { bn: "দোকানের সময়ে ছাঁটা", en: "Trimmed to shop hours" },

  leaveHeading: { bn: "ছুটি", en: "Time off" },
  leaveAdd: { bn: "ছুটি যোগ করো", en: "Add time off" },
  leaveNone: { bn: "সামনে কোনো ছুটি নেই।", en: "No time off coming up." },
  leaveWholeDay: { bn: "পুরো দিন", en: "Whole day" },
  leavePartDay: { bn: "দিনের একটা অংশ", en: "Part of the day" },
  leaveReasonPlaceholder: { bn: "কারণ (ঐচ্ছিক)", en: "Reason (optional)" },
  leaveSave: { bn: "রাখো", en: "Save" },
  leaveCancel: { bn: "বাতিল", en: "Cancel" },
  leaveRemove: { bn: "ছুটি মুছো", en: "Remove time off" },
  leaveFullDay: {
    bn: (date: string) => `${date} — পুরো দিন`,
    en: (date: string) => `${date} — all day`,
  },
  leaveRange: {
    bn: (date: string, from: string, to: string) => `${date} — ${from} থেকে ${to}`,
    en: (date: string, from: string, to: string) => `${date} — ${from} to ${to}`,
  },

  // ---- Reschedule ----
  rescheduleCta: { bn: "সময় বদলাও", en: "Reschedule" },
  rescheduleTitle: { bn: "নতুন সময় বেছে নাও", en: "Pick a new time" },
  rescheduleNone: {
    bn: "এই দিনে আর কোনো সময় খালি নেই — অন্য দিন দেখো।",
    en: "No free times left that day — try another.",
  },
  rescheduleConfirm: {
    bn: (time: string) => `${time}-এ সরাও`,
    en: (time: string) => `Move to ${time}`,
  },
  rescheduleDone: { bn: "অ্যাপয়েন্টমেন্ট সরানো হয়েছে।", en: "Appointment moved." },
  rescheduleHistory: {
    bn: (n: string) => `${n} বার সরানো হয়েছে`,
    en: (n: string) => `Moved ${n} time(s)`,
  },

  nowLabel: { bn: "এখন", en: "Now" },
  runsPastClose: { bn: "বন্ধের সময় পেরিয়ে যাচ্ছে", en: "Runs past closing" },
  startsBeforeOpen: { bn: "খোলার আগে শুরু", en: "Starts before opening" },

  // ---- Appointment statuses (mirrors the planned appointment_status enum) ----
  statusBOOKED: { bn: "বুক করা", en: "Booked" },
  statusCONFIRMED: { bn: "নিশ্চিত", en: "Confirmed" },
  statusIN_PROGRESS: { bn: "চলছে", en: "In progress" },
  statusDONE: { bn: "শেষ", en: "Done" },
  statusCANCELLED: { bn: "বাতিল", en: "Cancelled" },
  statusNO_SHOW: { bn: "আসেনি", en: "No show" },

  // ---- How booking works now that it is live ----
  liveTitle: { bn: "অ্যাপয়েন্টমেন্ট বুকিং চালু", en: "Appointment booking is live" },
  liveBody: {
    bn: "কাস্টমার তোমার দোকানের পাতা থেকে সার্ভিস, দিন আর সময় বেছে বুক করতে পারছে। যে সময় ইতিমধ্যেই কারো নামে বুক, সেটা তাকে দেখানোই হবে না।",
    en: "Customers can pick a service, a day and a time on your shop page. A time that is already taken is never offered to them.",
  },
  liveSlotRule: {
    bn: "সার্ভিসের সময় ধরেই স্লট বসে — সার্ভিসের সময় বদলালে স্লটও বদলাবে",
    en: "Slot length comes from the service's duration — change one and the other follows",
  },
  liveHoursRule: {
    bn: "দোকানের সময়, প্রত্যেকের নিজের কর্মঘণ্টা আর ছুটি — তিনটেই স্লট ঠিক করে",
    en: "Shop hours, each person's own hours and their time off all shape the slots",
  },
  liveStatusRule: {
    bn: "বোর্ডে অ্যাপয়েন্টমেন্টে চাপ দিয়ে নিশ্চিত, শুরু, শেষ বা বাতিল করো",
    en: "Tap an appointment on the board to confirm, start, finish or cancel it",
  },
  liveComingReminder: {
    bn: "কাস্টমার আগের রাতে নিজে থেকেই মনে করিয়ে দেওয়ার নোটিফিকেশন পাবে",
    en: "Customers get a reminder notification the night before, on their own",
  },

  // ---- Quick actions ----
  setUpTitle: { bn: "এখনই যা গুছিয়ে রাখতে পারো", en: "What you can set up now" },
  setUpSeats: { bn: "সিট ও বিউটিশিয়ান যোগ করো", en: "Add seats and beauticians" },
  setUpSeatsHint: {
    bn: "অ্যাপয়েন্টমেন্ট এলে এদের নামেই স্লট বসবে।",
    en: "Slots will be booked against these when appointments arrive.",
  },
  setUpServices: { bn: "সার্ভিস ও সময় ঠিক করো", en: "Set your services and their length" },
  setUpServicesHint: {
    bn: "প্রতিটা সার্ভিসে কত সময় লাগে — সেটাই স্লটের দৈর্ঘ্য ঠিক করবে।",
    en: "How long each service takes is what will decide the slot length.",
  },
} satisfies Dict;
