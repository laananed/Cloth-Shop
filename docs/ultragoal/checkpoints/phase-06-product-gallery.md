# Phase 06 - Product Gallery

Status: COMPLETE_WITH_LIMITATION

- Database description is the storefront card and shared-detail source.
- Product cards and favorite cards reuse one detail modal.
- Main-first sorted images drive thumbnails and one shared lightbox with wrap navigation, arrows, keyboard, Esc, overlay close, counter, subtle external hint, scroll lock, focus restoration, and failure placeholder.
- Single-image lightboxes hide navigation controls; mobile layout caps widths and prevents viewport overflow.
- Central availability state renders one status overlay; sold-out products keep detail access while off-shelf detail/actions are disabled.
- Purchase modal state is separate and remains intact.

TDD RED 5/5, GREEN 5/5, full regression 111/111. Live database/browser screenshot validation remains blocked by MySQL credentials.
