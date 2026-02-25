/**
 * i18n 사전 — 한국어 (기본값)
 */

export interface Dictionary {
    nav: {
        notice: string;
        strategy: string;
        threeAlliances: string;
        freeBoard: string;
        diplomacy: string;
        kdhGrid: string;
        allianceName: string;
    };
    search: {
        placeholder: string;
        submit: string;
        results: string;
        noResults: string;
        allBoards: string;
    };
    home: {
        badge: string;
        titleBrand: string;
        titleLine1: string;
        titleLine2: string;
        subtitle: string;
        subtitleHighlight: string;
        subtitleEnd: string;
        recentNotice: string;
        recentFreeBoard: string;
        viewAll: string;
        noNotice: string;
        noFreePost: string;
        writeHint: string;
    };
    quickLinks: {
        freeBoard: string;
        freeBoardDesc: string;
        diplomacy: string;
        diplomacyDesc: string;
    };
    features: {
        strategy: string;
        strategyLabel: string;
        realtime: string;
        realtimeLabel: string;
        multilang: string;
        multilangLabel: string;
    };
    fab: {
        notice: string;
        freeBoard: string;
        noticeTitle: string;
        freeBoardTitle: string;
        quickWrite: string;
    };
    langSelector: {
        label: string;
    };
    board: {
        newPost: string;
        titleLabel: string;
        titlePlaceholder: string;
        contentLabel: string;
        contentPlaceholder: string;
        imageLabel: string;
        imageOptional: string;
        imageHint: string;
        submit: string;
        submitting: string;
        postList: string;
        postCount: string;          /* "건" */
        writeHintText: string;      /* "새 글 작성은 화면 우측 하단..." */
        writeHintBtn: string;       /* "빠른 글쓰기" */
        firstPostHint: string;      /* "우측 하단 ✏ 버튼으로 첫 글을..." */
        readMore: string;           /* "자세히" */
        refresh: string;
        loading: string;
        translateBtn: string;
        translating: string;
        translateError: string;
        translatedLabel: string;
        originalLabel: string;
        originalShowing: string;    /* "원문을 표시 중입니다." */
        removeImage: string;
        validationError: string;
        uploadError: string;
        successMsg: string;
        successRedirecting: string; /* "목록 페이지로 이동 중..." */
        editorImageHint: string;    /* 에디터 이미지 삽입 안내 */
        nicknameLabel: string;      /* "닉네임" */
        nicknameOptional: string;   /* "(선택)" */
        nicknamePlaceholder: string;/* "연맹 닉네임을 입력하세요" */
        cancelBtn: string;          /* "← 취소" */
        /* 게시글 상세 */
        backToList: string;         /* "목록으로" */
        deletePost: string;         /* "게시글 삭제" */
        deleteDesc: string;         /* "삭제하려면 관리자 비밀번호를 입력하세요." */
        deleteDescHighlight: string;/* "관리자 비밀번호" */
        deletePwPlaceholder: string;/* "비밀번호 입력" */
        deleteCancelBtn: string;    /* "취소" */
        deleteConfirmBtn: string;   /* "🗑️ 삭제" */
        deletingBtn: string;        /* "삭제 중..." */
        deletePwWrong: string;      /* "비밀번호가 일치하지 않습니다." */
        deleteFailed: string;       /* "삭제 실패: " */
        prevPost: string;           /* "이전 글" */
        nextPost: string;           /* "다음 글" */
        firstPost: string;          /* "첫 번째 글입니다" */
        lastPost: string;           /* "마지막 글입니다" */
        /* 게시글 수정 */
        postPwLabel: string;        /* "게시 비밀번호 (선택)" */
        postPwPlaceholder: string;  /* "수정/삭제용 비밀번호 설정" */
        postPwHint: string;         /* "비밀번호 설정 시 본인만 수정/삭제 가능" */
        editPost: string;           /* "게시글 수정" */
        editSaveBtn: string;        /* "저장" */
        editCancelBtn: string;      /* "취소" */
        editPwPrompt: string;       /* "수정/삭제할 비밀번호를 입력하세요" */
        editPwWrong: string;        /* "비밀번호가 일치하지 않습니다" */
        editSuccess: string;        /* "수정되었습니다" */
        editFailed: string;         /* "수정 실패: " */
        editOrDelete: string;       /* "수정 또는 삭제" */
        btnEdit: string;            /* "✏️ 수정" */
        btnDelete: string;          /* "🗑️ 삭제" */
        noPwSet: string;            /* "이 글은 비밀번호가 설정되어 있지 않습니다." */
    };
    comments: {
        title: string;
        authorLabel: string;
        authorPlaceholder: string;
        contentLabel: string;
        contentPlaceholder: string;
        submit: string;
        submitting: string;
        empty: string;
        validationError: string;
        submitError: string;
        deleteConfirm: string;
        successMsg: string;         /* "댓글이 등록됐습니다!" */
        iconPickerTitle: string;    /* "아이콘 선택" */
        meLabel: string;            /* "나" */
        iconHint: string;           /* "아이콘을 클릭해서..." */
        nickSaved: string;          /* "닉네임 저장됨:" */
        justNow: string;            /* "방금 전" */
        minutesAgo: string;         /* "분 전" */
        hoursAgo: string;           /* "시간 전" */
        daysAgo: string;            /* "일 전" */
        refreshError: string;       /* 페이지 새로고침 오류 */
    };
    officers: {
        sectionTitle: string;      /* "간부 (R4) 명단" */
        teamCount: string;         /* "4팀" */
        adminMode: string;         /* 관리자 모드 안내 */
        r4Label: string;           /* "R4" */
        role1: string;             /* 연맹전 오더 및 외교 담당 */
        role2: string;             /* 성검 전투 징표 ... */
        role3: string;             /* 신규 연맹원 ... */
        role4: string;             /* 자원 관리 ... */
        editBtn: string;           /* "수정" */
        editingBtn: string;        /* "수정 중…" */
        saveBtn: string;           /* "저장하기" */
        cancelBtn: string;         /* "취소" */
        saveSuccess: string;       /* "✅ 저장되었습니다!" */
        pwPrompt: string;          /* 비밀번호 입력 안내 */
        pwWrong: string;           /* 비밀번호 오류 */
    };
    schedule: {
        sectionTitle: string;      /* "오늘의 주요 일정" */
        viewAll: string;           /* "전체 일정표" */
        noEvents: string;          /* "오늘 진행 일정이 없습니다." */
        statusLive: string;        /* "● LIVE" */
        statusSoon: string;        /* "◎ 예정" */
        statusEnded: string;       /* "✕ 종료" */
        /* 이벤트 제목 */
        holySword: string;
        holySwordSub: string;
        holySwordTime: string;
        threeAlliances: string;
        threeAlliancesSub: string;
        threeAlliancesTime: string;
        topKingdom: string;
        topKingdomSub: string;
        topKingdomTime: string;
        divineBeast: string;
        divineBeastSub: string;
        divineBeastTime: string;
        supplyDrop: string;
        supplyDropSub: string;
        supplyDropTime: string;
        worldBoss: string;
        worldBossSub: string;
        worldBossTime: string;
    };
}

const ko: Dictionary = {
    nav: {
        notice: "공지사항",
        strategy: "공략",
        threeAlliances: "삼대 연맹 전투",
        freeBoard: "자유 게시판",
        diplomacy: "연맹원 명부 & 외교",
        kdhGrid: "좌표 그리드",
        allianceName: "킹샷 연맹",
    },
    search: {
        placeholder: "아이디 또는 내용 검색...",
        submit: "검색",
        results: "전체 검색 결과",
        noResults: "검색 결과가 없습니다.",
        allBoards: "공지사항 & 자유게시판 결과",
    },
    home: {
        badge: "Official Alliance Website",
        titleBrand: "[ KDH ]",
        titleLine1: "킹샷 연맹 웹사이트에",
        titleLine2: "오신 것을 환영합니다 👋",
        subtitle: "함께 소통하고, 전략을 공유하며,",
        subtitleHighlight: "최고의 연맹",
        subtitleEnd: "으로 나아갑시다! 🏆",
        recentNotice: "📢 최근 공지사항",
        recentFreeBoard: "💬 최근 자유게시판",
        viewAll: "전체보기",
        noNotice: "아직 등록된 공지사항이 없습니다. 우측 하단",
        noFreePost: "아직 작성된 글이 없습니다. 우측 하단",
        writeHint: " 버튼으로 첫 글을 작성해 보세요!",
    },
    quickLinks: {
        freeBoard: "자유 게시판",
        freeBoardDesc: "연맹원과 자유롭게 소통",
        diplomacy: "외교 현황",
        diplomacyDesc: "동맹 · 적대 연맹 정보",
    },
    features: {
        strategy: "연맹 공략",
        strategyLabel: "전략 시뮬레이션",
        realtime: "실시간 공유",
        realtimeLabel: "자유 게시판",
        multilang: "다국어 지원",
        multilangLabel: "글로벌 연맹",
    },
    fab: {
        notice: "공지",
        freeBoard: "자게",
        noticeTitle: "공지사항 글쓰기",
        freeBoardTitle: "자유게시판 글쓰기",
        quickWrite: "✏️ 빠른 글쓰기",
    },
    langSelector: {
        label: "언어 선택",
    },
    board: {
        newPost: "✏️ 새 글 작성",
        titleLabel: "제목",
        titlePlaceholder: "제목을 입력하세요",
        contentLabel: "내용",
        contentPlaceholder: "내용을 입력하세요",
        imageLabel: "이미지 첨부",
        imageOptional: "(선택)",
        imageHint: "클릭해서 이미지 선택 (JPG, PNG, GIF, WebP)",
        submit: "📝 등록",
        submitting: "등록 중...",
        postList: "📋 게시글 목록",
        postCount: "건",
        writeHintText: "새 글 작성은 화면 우측 하단",
        writeHintBtn: "✏️ 빠른 글쓰기",
        firstPostHint: "우측 하단 ✏️ 버튼으로 첫 글을 작성해 보세요!",
        readMore: "자세히",
        refresh: "새로고침",
        loading: "게시글을 불러오는 중...",
        translateBtn: "🌐 번역하기",
        translating: "번역 중...",
        translateError: "번역 실패. 잠시 후 다시 시도해 주세요.",
        translatedLabel: "번역본",
        originalLabel: "원문 보기",
        originalShowing: "원문을 표시 중입니다.",
        removeImage: "✕ 제거",
        validationError: "제목과 내용을 모두 입력해 주세요.",
        uploadError: "이미지 업로드에 실패했습니다. 다시 시도해 주세요.",
        successMsg: "게시글이 성공적으로 등록되었습니다! 🎉",
        successRedirecting: "목록 페이지로 이동 중...",
        editorImageHint: "🖼️ 본문 이미지를 추가하려면 에디터 툴바의 이미지 버튼(🖼)을 사용하세요.",
        nicknameLabel: "닉네임",
        nicknameOptional: "(선택)",
        nicknamePlaceholder: "연맹 닉네임을 입력하세요",
        cancelBtn: "← 취소",
        backToList: "목록으로",
        deletePost: "게시글 삭제",
        deleteDesc: "삭제하려면",
        deleteDescHighlight: "관리자 비밀번호",
        deletePwPlaceholder: "비밀번호 입력",
        deleteCancelBtn: "취소",
        deleteConfirmBtn: "🗑️ 삭제",
        deletingBtn: "삭제 중...",
        deletePwWrong: "비밀번호가 일치하지 않습니다.",
        deleteFailed: "삭제 실패: ",
        prevPost: "이전 글",
        nextPost: "다음 글",
        firstPost: "첫 번째 글입니다",
        lastPost: "마지막 글입니다",
        postPwLabel: "게시 비밀번호",
        postPwPlaceholder: "수정/삭제용 비밀번호 설정 (선택)",
        postPwHint: "비밀번호를 설정하면 본인만 수정/삭제할 수 있습니다.",
        editPost: "게시글 수정",
        editSaveBtn: "✅ 저장",
        editCancelBtn: "취소",
        editPwPrompt: "비밀번호를 입력하세요",
        editPwWrong: "비밀번호가 일치하지 않습니다.",
        editSuccess: "수정되었습니다!",
        editFailed: "수정 실패: ",
        editOrDelete: "수정 또는 삭제",
        btnEdit: "✏️ 수정",
        btnDelete: "🗑️ 삭제",
        noPwSet: "이 글에 비밀번호가 설정되어 있지 않습니다. 수정/삭제하려면 관리자 번호(3741)를 입력하세요.",
    },
    comments: {
        title: "💬 댓글",
        authorLabel: "닉네임",
        authorPlaceholder: "닉네임을 입력하세요",
        contentLabel: "댓글 내용",
        contentPlaceholder: "댓글을 남겨주세요...",
        submit: "💬 등록",
        submitting: "등록 중...",
        empty: "댓글이 없습니다. 첫 댓글을 남겨보세요! 🙌",
        validationError: "닉네임과 댓글 내용을 입력해 주세요.",
        submitError: "댓글 등록에 실패했습니다.",
        deleteConfirm: "이 댓글을 삭제하시겠습니까?",
        successMsg: "✅ 댓글이 등록됐습니다!",
        iconPickerTitle: "아이콘 선택",
        meLabel: "나",
        iconHint: "👆 아이콘을 클릭해서 프로필을 커스텀하세요",
        nickSaved: "닉네임 저장됨:",
        justNow: "방금 전",
        minutesAgo: "분 전",
        hoursAgo: "시간 전",
        daysAgo: "일 전",
        refreshError: "페이지를 새로고침 후 다시 시도해 주세요.",
    },
    officers: {
        sectionTitle: "간부 (R4) 명단",
        teamCount: "4팀",
        adminMode: "🔓 관리자 모드 — 닉네임과 역할을 수정하고 저장 버튼을 누르세요.",
        r4Label: "R4",
        role1: "연맹전 오더 및 외교 담당",
        role2: "성검 전투 징표 배치 및 공지 담당",
        role3: "신규 연맹원 가입 심사 및 안내",
        role4: "자원 관리 및 이벤트 보상 조율",
        editBtn: "수정",
        editingBtn: "수정 중…",
        saveBtn: "💾 저장하기",
        cancelBtn: "취소",
        saveSuccess: "✅ 저장되었습니다!",
        pwPrompt: "🔒 관리자 비밀번호를 입력하세요:",
        pwWrong: "❌ 비밀번호가 올바르지 않습니다.",
    },
    schedule: {
        sectionTitle: "오늘의 주요 일정",
        viewAll: "전체 일정표",
        noEvents: "오늘 진행 일정이 없습니다.",
        statusLive: "● LIVE",
        statusSoon: "◎ 예정",
        statusEnded: "✕ 종료",
        holySword: "성검 전투",
        holySwordSub: "전 연맹 필참",
        holySwordTime: "매일 20:00",
        threeAlliances: "삼대 연맹전",
        threeAlliancesSub: "3대 연맹 참전",
        threeAlliancesTime: "토·일 21:00",
        topKingdom: "최강 왕국",
        topKingdomSub: "왕국 랭킹전",
        topKingdomTime: "금~일 진행",
        divineBeast: "신수의 선물",
        divineBeastSub: "신수 사냥 보상",
        divineBeastTime: "매일 18:00",
        supplyDrop: "보급 지원",
        supplyDropSub: "연맹 물자 강화",
        supplyDropTime: "화·목 15:00",
        worldBoss: "월드 보스",
        worldBossSub: "공통 공격 이벤트",
        worldBossTime: "수·토 19:30",
    },
};

export default ko;
