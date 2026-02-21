/**
 * i18n 사전 — 한국어 (기본값)
 */

export interface Dictionary {
    nav: {
        notice: string;
        strategy: string;
        holySword: string;
        threeAlliances: string;
        freeBoard: string;
        diplomacy: string;
        allianceName: string;
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
        holySword: string;
        holySwordDesc: string;
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
        refresh: string;
        loading: string;
        translateBtn: string;
        translating: string;
        translateError: string;
        translatedLabel: string;
        originalLabel: string;
        removeImage: string;
        validationError: string;
        uploadError: string;
        successMsg: string;
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
    };
}

const ko: Dictionary = {
    nav: {
        notice: "공지사항",
        strategy: "공략",
        holySword: "성검 전투",
        threeAlliances: "삼대 연맹 전투",
        freeBoard: "자유 게시판",
        diplomacy: "연맹원 명부 & 외교",
        allianceName: "킹샷 연맹",
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
        holySword: "성검 전투 공략",
        holySwordDesc: "전략 시뮬레이션 맵",
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
        refresh: "새로고침",
        loading: "게시글을 불러오는 중...",
        translateBtn: "🌐 번역하기",
        translating: "번역 중...",
        translateError: "번역 실패. 잠시 후 다시 시도해 주세요.",
        translatedLabel: "번역본",
        originalLabel: "원문 보기",
        removeImage: "✕ 제거",
        validationError: "제목과 내용을 모두 입력해 주세요.",
        uploadError: "이미지 업로드에 실패했습니다. 다시 시도해 주세요.",
        successMsg: "게시글이 성공적으로 등록똑습니다! 🎉",
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
    },
};

export default ko;
