/**
 * i18n 사전 — 한국어 (기본값)
 * Dictionary 타입은 string 기반으로 정의하여
 * 다른 언어 파일이 동일 구조를 따를 수 있도록 합니다.
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
};

export default ko;
