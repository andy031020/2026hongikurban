/* =========================================================
   사이트 설정 — 이 파일만 고치면 됩니다
   ========================================================= */
window.CONFIG = {
  /* Supabase 프로젝트 > Project Settings > API 에서 복사해 붙여 넣기 */
  SUPABASE_URL: "https://pbvxyzixuohpbefkjvcn.supabase.co/rest/v1/",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBidnh5eml4dW9ocGJlZmtqdmNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0MDc3MTUsImV4cCI6MjEwNzk4MzcxNX0.vrJqJobOYQgiJC68VkJ34nZMyILh_El62IydJ1geSjU",

  /* 팀 정보 (공개 정보만). 우체통 코드는 여기 넣지 마세요 (setup/supabase.sql 에만).
     id 는 QR 주소(#team-d1)에 쓰이니 바꾸면 QR도 다시 뽑아야 합니다.
     title 에 판넬 제목을 넣으면 팀 페이지에 표시됩니다 (비워 두면 팀명만 표시). */
  GROUPS: ["설계", "교통", "물류"],
  TEAMS: [
    { id: "d1", group: "설계", name: "설계 1팀", title: "" },
    { id: "d2", group: "설계", name: "설계 2팀", title: "" },
    { id: "d3", group: "설계", name: "설계 3팀", title: "" },
    { id: "d4", group: "설계", name: "설계 4팀", title: "" },
    { id: "d5", group: "설계", name: "설계 5팀", title: "" },
    { id: "d6", group: "설계", name: "설계 6팀", title: "" },
    { id: "t1", group: "교통", name: "교통 1팀", title: "" },
    { id: "t2", group: "교통", name: "교통 2팀", title: "" },
    { id: "t3", group: "교통", name: "교통 3팀", title: "" },
    { id: "t4", group: "교통", name: "교통 4팀", title: "" },
    { id: "t5", group: "교통", name: "교통 5팀", title: "" },
    { id: "t6", group: "교통", name: "교통 6팀", title: "" },
    { id: "t7", group: "교통", name: "교통 7팀", title: "" },
    { id: "l1", group: "물류", name: "물류 1팀", title: "" },
    { id: "l2", group: "물류", name: "물류 2팀", title: "" },
    { id: "l3", group: "물류", name: "물류 3팀", title: "" },
    { id: "l4", group: "물류", name: "물류 4팀", title: "" },
  ],

  RELS: ["부모님·가족", "친구", "선후배", "교수님·관계자", "익명"],
  STICKERS: ["💐", "👏", "✨", "🎓", "❤️", "🔥"],
};
