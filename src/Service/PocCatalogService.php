<?php

declare(strict_types=1);

namespace App\Service;

use Symfony\Component\DependencyInjection\Attribute\Autowire;

final class PocCatalogService
{
    /**
     * @var array<string, mixed>|null
     */
    private ?array $catalog = null;

    /**
     * @var string[]
     */
    private const MONTH_NAMES = [
        'januari',
        'februari',
        'maart',
        'april',
        'mei',
        'juni',
        'juli',
        'augustus',
        'september',
        'oktober',
        'november',
        'december',
    ];

    /**
     * @var string[]
     */
    private const DAY_NAMES = [
        'Maandag',
        'Dinsdag',
        'Woensdag',
        'Donderdag',
        'Vrijdag',
        'Zaterdag',
        'Zondag',
    ];

    /**
     * @var string[]
     */
    private const DAY_NAMES_SHORT = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

    /**
     * @var array<int, array{name: string, date: string, everyFiveYears?: bool}>
     */
    private const FALLBACK_HOLIDAYS = [
        ['name' => 'Nieuwjaarsdag', 'date' => '01-01'],
        ['name' => 'Koningsdag', 'date' => '04-27'],
        ['name' => 'Bevrijdingsdag', 'date' => '05-05', 'everyFiveYears' => true],
        ['name' => 'Eerste Kerstdag', 'date' => '12-25'],
        ['name' => 'Tweede Kerstdag', 'date' => '12-26'],
    ];

    public function __construct(
        #[Autowire('%kernel.project_dir%')]
        private readonly string $projectDir,
    ) {
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function searchWerfsleutels(string $query = '', string $barcode = '', int $limit = 20): array
    {
        $queryNormalized = strtolower(trim($query));
        $barcodeNormalized = preg_replace('/\D+/', '', $barcode) ?? '';
        $items = $this->getWerfsleutels();

        if ('' !== $barcodeNormalized) {
            $items = array_values(array_filter(
                $items,
                static fn (array $item): bool => (preg_replace('/\D+/', '', (string) ($item['barcode'] ?? '')) ?? '') === $barcodeNormalized,
            ));
        }

        if ('' !== $queryNormalized) {
            $items = array_values(array_filter(
                $items,
                static fn (array $item): bool => str_contains(strtolower((string) ($item['salesCode'] ?? '')), $queryNormalized)
                    || str_contains(strtolower((string) ($item['title'] ?? '')), $queryNormalized)
                    || str_contains(strtolower((string) ($item['magazine'] ?? '')), $queryNormalized)
                    || str_contains((string) ($item['price'] ?? ''), $queryNormalized),
            ));
        }

        $safeLimit = max(1, min($limit, 250));

        return array_slice($items, 0, $safeLimit);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function searchArticles(
        string $query = '',
        ?string $magazine = null,
        bool $popular = false,
        ?string $tab = null,
        int $limit = 20,
    ): array {
        $queryNormalized = strtolower(trim($query));
        $items = $this->getArticles();

        if (null !== $tab) {
            $tabNormalized = strtolower(trim($tab));
            if ('popular' === $tabNormalized) {
                $items = array_values(array_filter($items, static fn (array $article): bool => (bool) ($article['popular'] ?? false)));
            } elseif (!\in_array($tabNormalized, ['all', ''], true)) {
                $items = array_values(array_filter(
                    $items,
                    static fn (array $article): bool => strtolower((string) ($article['magazine'] ?? '')) === $tabNormalized,
                ));
            }
        }

        if (null !== $magazine && '' !== trim($magazine)) {
            $magazineNormalized = strtolower(trim($magazine));
            $items = array_values(array_filter(
                $items,
                static fn (array $article): bool => strtolower((string) ($article['magazine'] ?? '')) === $magazineNormalized,
            ));
        }

        if ($popular) {
            $items = array_values(array_filter($items, static fn (array $article): bool => (bool) ($article['popular'] ?? false)));
        }

        if ('' !== $queryNormalized) {
            $items = array_values(array_filter(
                $items,
                static fn (array $article): bool => str_contains(strtolower((string) ($article['name'] ?? '')), $queryNormalized)
                    || str_contains(strtolower((string) ($article['code'] ?? '')), $queryNormalized)
                    || str_contains(strtolower((string) ($article['magazine'] ?? '')), $queryNormalized)
                    || str_contains(strtolower((string) ($article['category'] ?? '')), $queryNormalized),
            ));
        }

        $safeLimit = max(1, min($limit, 250));

        return array_slice($items, 0, $safeLimit);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findArticle(int $articleId): ?array
    {
        foreach ($this->getArticles() as $article) {
            if ((int) ($article['id'] ?? -1) === $articleId) {
                return $article;
            }
        }

        return null;
    }

    /**
     * @param array<int, array<string, mixed>> $items
     * @return array<string, mixed>
     */
    public function quoteArticleOrder(array $items, ?string $couponCode = null): array
    {
        $normalizedItems = $this->normalizeOrderItems($items);
        $subtotal = round(array_reduce(
            $normalizedItems,
            static fn (float $carry, array $item): float => $carry + ((float) $item['unitPrice'] * (int) $item['quantity']),
            0.0,
        ), 2);

        [$discounts, $totalDiscount, $coupon] = $this->calculateDiscounts($normalizedItems, $couponCode);
        $total = round($subtotal - $totalDiscount, 2);

        return [
            'items' => $normalizedItems,
            'subtotal' => $subtotal,
            'discounts' => $discounts,
            'totalDiscount' => round($totalDiscount, 2),
            'total' => $total,
            'couponCode' => \is_array($coupon) && true === ($coupon['valid'] ?? false) ? $coupon['code'] : null,
            'coupon' => $coupon,
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function getWinbackOffers(?string $reason): array
    {
        $normalizedReason = strtolower(trim((string) ($reason ?? 'other')));
        $offers = $this->getFixtureValue('winbackOffers', []);
        if (!\is_array($offers)) {
            return [];
        }

        if (!isset($offers[$normalizedReason]) || !\is_array($offers[$normalizedReason])) {
            $normalizedReason = 'other';
        }

        return $offers[$normalizedReason] ?? [];
    }

    /**
     * @return array<string, mixed>
     */
    public function getServiceNumbers(): array
    {
        $serviceNumbers = $this->getFixtureValue('serviceNumbers', []);

        return \is_array($serviceNumbers) ? $serviceNumbers : [];
    }

    /**
     * @return array<string, mixed>
     */
    public function getDispositionCategories(): array
    {
        $categories = $this->getFixtureValue('dispositionCategories', []);

        return \is_array($categories) ? $categories : [];
    }

    /**
     * @return array<string, mixed>
     */
    public function getWerfsleutelChannels(): array
    {
        $channels = $this->getFixtureValue('werfsleutelChannels', []);

        return \is_array($channels) ? $channels : [];
    }

    /**
     * @return array<string, mixed>
     */
    public function getCatalogBootstrap(): array
    {
        $today = new \DateTimeImmutable('today');

        return [
            'serviceNumbers' => $this->getServiceNumbers(),
            'dispositionCategories' => $this->getDispositionCategories(),
            'werfsleutelChannels' => $this->getWerfsleutelChannels(),
            'delivery' => [
                'recommendedDate' => $this->getMinimumDeliveryDate($today)->format('Y-m-d'),
                'today' => $today->format('Y-m-d'),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function getDeliveryCalendar(int $year, int $month): array
    {
        $today = new \DateTimeImmutable('today');
        $minimumDeliveryDate = $this->getMinimumDeliveryDate($today);
        $recommendedDate = $minimumDeliveryDate;
        $daysInMonth = (int) (new \DateTimeImmutable(sprintf('%04d-%02d-01', $year, $month)))->format('t');
        $days = [];

        for ($day = 1; $day <= $daysInMonth; ++$day) {
            $current = new \DateTimeImmutable(sprintf('%04d-%02d-%02d', $year, $month, $day));
            $available = $this->isDeliveryDay($current) && $current >= $minimumDeliveryDate;
            $weekdayIndex = (int) $current->format('N') - 1;

            $days[] = [
                'date' => $current->format('Y-m-d'),
                'day' => $day,
                'weekday' => self::DAY_NAMES[$weekdayIndex],
                'weekdayShort' => self::DAY_NAMES_SHORT[$weekdayIndex],
                'available' => $available,
                'past' => $current < $today,
                'recommended' => $current == $recommendedDate,
                'title' => sprintf('%s %d %s', self::DAY_NAMES[$weekdayIndex], $day, self::MONTH_NAMES[$month - 1]),
            ];
        }

        return [
            'year' => $year,
            'month' => $month,
            'monthLabel' => sprintf('%s %d', self::MONTH_NAMES[$month - 1], $year),
            'today' => $today->format('Y-m-d'),
            'minimumDate' => $minimumDeliveryDate->format('Y-m-d'),
            'recommendedDate' => $recommendedDate->format('Y-m-d'),
            'days' => $days,
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function getArticles(): array
    {
        $articles = $this->getFixtureValue('articles', []);

        return \is_array($articles) ? $articles : [];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function getWerfsleutels(): array
    {
        $items = $this->getFixtureValue('werfsleutels', []);

        return \is_array($items) ? $items : [];
    }

    /**
     * @param list<array<string, mixed>> $items
     * @return list<array<string, mixed>>
     */
    private function normalizeOrderItems(array $items): array
    {
        $normalized = [];

        foreach ($items as $rawItem) {
            if (!\is_array($rawItem)) {
                continue;
            }

            $articleIdRaw = $rawItem['articleId'] ?? null;
            $articleId = is_numeric($articleIdRaw) ? (int) $articleIdRaw : -1;
            $catalogArticle = $articleId >= 0 ? $this->findArticle($articleId) : null;

            $quantity = is_numeric($rawItem['quantity'] ?? null) ? (int) $rawItem['quantity'] : 1;
            $quantity = max($quantity, 1);

            $unitPrice = $rawItem['unitPrice'] ?? null;
            if (null === $unitPrice && \is_array($catalogArticle)) {
                $unitPrice = $catalogArticle['price'] ?? 0;
            }

            $normalized[] = [
                'articleId' => $articleId >= 0 ? $articleId : $articleIdRaw,
                'code' => (string) ($rawItem['code'] ?? $catalogArticle['code'] ?? ''),
                'name' => (string) ($rawItem['name'] ?? $catalogArticle['name'] ?? 'Artikel'),
                'unitPrice' => round((float) $unitPrice, 2),
                'quantity' => $quantity,
                'magazine' => (string) ($rawItem['magazine'] ?? $catalogArticle['magazine'] ?? 'Onbekend'),
            ];
        }

        return $normalized;
    }

    /**
     * @param list<array<string, mixed>> $items
     * @return array{0: list<array<string, mixed>>, 1: float, 2: array<string, mixed>|null}
     */
    private function calculateDiscounts(array $items, ?string $couponCode): array
    {
        $coupons = $this->getFixtureValue('coupons', []);
        if (!\is_array($coupons)) {
            $coupons = [];
        }

        $subtotal = array_reduce(
            $items,
            static fn (float $carry, array $item): float => $carry + ((float) $item['unitPrice'] * (int) $item['quantity']),
            0.0,
        );
        $discounts = [];
        $totalDiscount = 0.0;

        $volumeDiscounts = [];
        $volumeTotal = 0.0;
        foreach ($items as $item) {
            if ((int) $item['quantity'] < 5) {
                continue;
            }

            $itemTotal = (float) $item['unitPrice'] * (int) $item['quantity'];
            $amount = round($itemTotal * 0.10, 2);
            $volumeDiscounts[] = [
                'type' => 'Stapelkorting',
                'icon' => 'stack',
                'description' => sprintf('10%% korting op %s (%dx)', $item['name'], $item['quantity']),
                'amount' => $amount,
                'itemName' => $item['name'],
            ];
            $volumeTotal += $amount;
        }

        $magazines = array_values(array_unique(array_map(static fn (array $item): string => (string) $item['magazine'], $items)));
        if (3 === count($magazines) && count($items) >= 3) {
            $bundleDiscount = round($subtotal * 0.15, 2);
            if ($bundleDiscount > $volumeTotal) {
                $discounts = [[
                    'type' => 'Bundelkorting',
                    'icon' => 'bundle',
                    'description' => 'Artikelen van alle 3 magazines',
                    'amount' => $bundleDiscount,
                ]];
                $totalDiscount = $bundleDiscount;
            } else {
                $discounts = $volumeDiscounts;
                $totalDiscount = round($volumeTotal, 2);
            }
        } else {
            $discounts = $volumeDiscounts;
            $totalDiscount = round($volumeTotal, 2);
        }

        if ($subtotal >= 100 && 0.0 === $totalDiscount) {
            $amount = round($subtotal * 0.05, 2);
            $discounts[] = [
                'type' => 'Actiekorting',
                'icon' => 'target',
                'description' => 'Bij bestellingen vanaf EUR100',
                'amount' => $amount,
            ];
            $totalDiscount = round($totalDiscount + $amount, 2);
        }

        $couponResult = null;
        if (null !== $couponCode && '' !== trim($couponCode)) {
            $normalizedCoupon = strtoupper(trim($couponCode));
            $coupon = $coupons[$normalizedCoupon] ?? null;

            if (\is_array($coupon)) {
                $couponDiscount = 0.0;
                if ('fixed' === ($coupon['type'] ?? null)) {
                    $couponDiscount = min((float) ($coupon['amount'] ?? 0), max(0.0, $subtotal - $totalDiscount));
                } else {
                    $couponDiscount = ($subtotal - $totalDiscount) * (((float) ($coupon['amount'] ?? 0)) / 100);
                }

                $couponDiscount = round(max($couponDiscount, 0.0), 2);
                if ($couponDiscount > 0) {
                    $discounts[] = [
                        'type' => 'Kortingscode',
                        'icon' => 'coupon',
                        'description' => sprintf('%s (%s)', $coupon['description'], $normalizedCoupon),
                        'amount' => $couponDiscount,
                        'isCoupon' => true,
                    ];
                    $totalDiscount = round($totalDiscount + $couponDiscount, 2);
                }

                $couponResult = [
                    'valid' => true,
                    'code' => $normalizedCoupon,
                    'type' => $coupon['type'],
                    'amount' => $coupon['amount'],
                    'description' => $coupon['description'],
                ];
            } else {
                $couponResult = [
                    'valid' => false,
                    'code' => $normalizedCoupon,
                    'message' => sprintf('Kortingscode "%s" is ongeldig', $normalizedCoupon),
                ];
            }
        }

        return [$discounts, $totalDiscount, $couponResult];
    }

    private function getMinimumDeliveryDate(\DateTimeImmutable $today): \DateTimeImmutable
    {
        $businessDays = 0;
        $scan = $today;

        while ($businessDays < 2) {
            $scan = $scan->modify('+1 day');
            if ($this->isDeliveryDay($scan)) {
                ++$businessDays;
            }
        }

        return $scan;
    }

    private function isDeliveryDay(\DateTimeImmutable $candidate): bool
    {
        if (7 === (int) $candidate->format('N')) {
            return false;
        }

        return !\in_array($candidate->format('Y-m-d'), $this->holidaysForYear((int) $candidate->format('Y')), true);
    }

    /**
     * @return string[]
     */
    private function holidaysForYear(int $year): array
    {
        $holidays = [];

        foreach (self::FALLBACK_HOLIDAYS as $holiday) {
            if (('Bevrijdingsdag' === $holiday['name']) && true === ($holiday['everyFiveYears'] ?? false) && 0 !== $year % 5) {
                continue;
            }

            [$month, $day] = explode('-', $holiday['date']);
            $holidays[] = sprintf('%04d-%02d-%02d', $year, (int) $month, (int) $day);
        }

        $easter = $this->calculateEaster($year);
        foreach ([-2, 0, 1, 39, 49, 50] as $offset) {
            $holidays[] = $easter->modify(sprintf('%+d day', $offset))->format('Y-m-d');
        }

        return array_values(array_unique($holidays));
    }

    private function calculateEaster(int $year): \DateTimeImmutable
    {
        $a = $year % 19;
        $b = intdiv($year, 100);
        $c = $year % 100;
        $d = intdiv($b, 4);
        $e = $b % 4;
        $f = intdiv($b + 8, 25);
        $g = intdiv($b - $f + 1, 3);
        $h = (19 * $a + $b - $d - $g + 15) % 30;
        $i = intdiv($c, 4);
        $k = $c % 4;
        $l = (32 + 2 * $e + 2 * $i - $h - $k) % 7;
        $m = intdiv($a + 11 * $h + 22 * $l, 451);
        $month = intdiv($h + $l - 7 * $m + 114, 31);
        $day = (($h + $l - 7 * $m + 114) % 31) + 1;

        return new \DateTimeImmutable(sprintf('%04d-%02d-%02d', $year, $month, $day));
    }

    /**
     * @return array<string, mixed>
     */
    private function loadCatalog(): array
    {
        if (null !== $this->catalog) {
            return $this->catalog;
        }

        $path = $this->projectDir.'/fixtures/catalog.json';
        $raw = file_get_contents($path);
        if (false === $raw) {
            $this->catalog = [];

            return $this->catalog;
        }

        $decoded = json_decode($raw, true);
        $this->catalog = \is_array($decoded) ? $decoded : [];

        return $this->catalog;
    }

    /**
     * @param array<string, mixed>|list<mixed>|string|int|float|bool|null $default
     */
    private function getFixtureValue(string $key, mixed $default): mixed
    {
        $catalog = $this->loadCatalog();

        return $catalog[$key] ?? $default;
    }
}
