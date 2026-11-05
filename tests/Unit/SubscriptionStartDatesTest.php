<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Entity\WebaboOffer;
use App\Http\ApiProblemException;
use App\Repository\WebaboOfferRepository;
use App\Service\SubscriptionStartDates;
use App\Webabo\WebaboOfferCacheSchemaManager;
use App\Webabo\WebaboStartDateProviderInterface;
use Doctrine\DBAL\DriverManager;
use Doctrine\ORM\EntityManager;
use Doctrine\ORM\ORMSetup;
use Doctrine\Persistence\ManagerRegistry;
use PHPUnit\Framework\TestCase;

final class SubscriptionStartDatesTest extends TestCase
{
    private EntityManager $manager;
    private SubscriptionStartDates $dates;
    private WebaboStartDateProviderInterface $provider;

    protected function setUp(): void
    {
        $config = ORMSetup::createAttributeMetadataConfig([dirname(__DIR__, 2).'/src/Entity'], true);
        $config->enableNativeLazyObjects(true);
        $params = extension_loaded('pdo_sqlite') ? ['driver' => 'pdo_sqlite', 'memory' => true] : [
            'driver' => 'pdo_pgsql', 'host' => $_ENV['SESSION_DB_HOST'] ?? '127.0.0.1',
            'dbname' => $_ENV['SESSION_DB_NAME'] ?? 'kiwi_test', 'user' => 'kiwi', 'password' => 'kiwi',
        ];
        $connection = DriverManager::getConnection($params, $config);
        $connection->beginTransaction();
        $this->manager = new EntityManager($connection, $config);
        $registry = $this->createStub(ManagerRegistry::class);
        $registry->method('getManagerForClass')->willReturn($this->manager);
        $schema = new WebaboOfferCacheSchemaManager($connection, $this->manager);
        $schema->ensureSchema();
        $this->provider = $this->createMock(WebaboStartDateProviderInterface::class);
        $this->dates = new SubscriptionStartDates(new WebaboOfferRepository($registry), $schema, $this->provider);
    }

    protected function tearDown(): void
    {
        $this->manager->getConnection()->rollBack();
        $this->manager->getConnection()->close();
    }

    private function offer(string $code, string $product = 'GUIDE', array $variants = ['STANDARD'], array $extra = []): void
    {
        $offer = new WebaboOffer($code);
        $offer->refreshFromWebaboPayload($extra + ['salesCode' => $code, 'title' => 'Synthetic offer',
            'credentialKey' => 'second-mandant', 'mandant' => 'SECOND', 'productCode' => $product,
            'variantCodeList' => $variants], new \DateTimeImmutable());
        $this->manager->persist($offer);
        $this->manager->flush();
    }

    public function testAllFourMembershipCodesAreIndependentOfProviderAndEdition(): void
    {
        $this->provider->expects(self::never())->method('fetchStartDate');
        foreach (['ATV', 'ATL', 'ATM', 'STKN'] as $product) {
            $this->offer($product, $product, []);
            self::assertSame('membership', $this->dates->validate($product, null, '2026-01-10')['subscriptionKind']);
        }
    }

    public function testOnlyExactMembershipCodesAreExcludedAndSourceContextIsRetained(): void
    {
        $this->offer('A', 'ATV-GUIDE');
        $this->provider->expects(self::once())->method('fetchStartDate')
            ->with('second-mandant', 'ATV-GUIDE', 'STANDARD')->willReturn('2035-03-26');
        $result = $this->dates->validate('A', null, '2035-03-26');
        self::assertSame('2035-03-26', $result['sourceContext']['startDate']);
        self::assertSame('SECOND', $result['sourceContext']['mandant']);
        self::assertSame('STANDARD', $result['sourceContext']['variantCode']);
        self::assertArrayHasKey('checkedAt', $result['sourceContext']);
    }

    public function testMultipleEditionsRequireExplicitChoiceBeforeAnyProviderCall(): void
    {
        $this->offer('A', 'GUIDE', ['NORTH', 'SOUTH']);
        $this->provider->expects(self::never())->method('fetchStartDate');
        $this->expectException(ApiProblemException::class);
        $this->expectExceptionMessage('Kies een beschikbare editie');
        $this->dates->lookup('A');
    }

    public function testInvalidEditionIsRejectedBeforeAnyProviderCall(): void
    {
        $this->offer('A');
        $this->provider->expects(self::never())->method('fetchStartDate');
        $this->expectException(ApiProblemException::class);
        $this->dates->lookup('A', 'FORGED');
    }

    public function testSelectedEditionAndEachProductRetainTheirOwnDates(): void
    {
        $this->offer('A', 'GUIDE-A', ['NORTH', 'SOUTH']);
        $this->offer('B', 'GUIDE-B');
        $this->provider->method('fetchStartDate')->willReturnMap([
            ['second-mandant', 'GUIDE-A', 'SOUTH', '2035-03-26'],
            ['second-mandant', 'GUIDE-B', 'STANDARD', '2035-03-27'],
        ]);
        self::assertSame('2035-03-26', $this->dates->lookup('A', 'SOUTH')['startDate']);
        self::assertSame('2035-03-27', $this->dates->lookup('B')['startDate']);
    }

    public function testChangedSourceDateIsRecheckedWhenSaving(): void
    {
        $this->offer('A');
        $this->provider->expects(self::exactly(2))->method('fetchStartDate')->willReturnOnConsecutiveCalls('2035-03-26', '2035-03-27');
        self::assertSame('2035-03-26', $this->dates->lookup('A')['startDate']);
        $this->expectException(ApiProblemException::class);
        $this->expectExceptionMessage('De bezorgdatum is gewijzigd');
        $this->dates->validate('A', 'STANDARD', '2035-03-26');
    }

    /** @dataProvider invalidSourceDates */
    public function testPastOrInvalidSourceDatesNeverBecomeToday(string $date): void
    {
        $this->offer('A');
        $this->provider->method('fetchStartDate')->willReturn($date);
        $this->expectException(ApiProblemException::class);
        $this->dates->lookup('A');
    }

    public static function invalidSourceDates(): iterable
    {
        yield ['2000-01-01'];
        yield ['2035-02-30'];
        yield ['2035-03-26T00:00:00Z'];
        yield [''];
    }

    public function testUnknownOfferCannotBeClassifiedFromSubmittedProductData(): void
    {
        $this->provider->expects(self::never())->method('fetchStartDate');
        $this->expectException(ApiProblemException::class);
        $this->dates->validate('UNKNOWN', null, '2035-03-26');
    }

    public function testExpiredOfferIsRejectedBeforeProviderCall(): void
    {
        $this->offer('A', 'GUIDE', ['STANDARD'], ['offerDelivery' => ['validDate' => ['validUntil' => '2000-01-01']]]);
        $this->provider->expects(self::never())->method('fetchStartDate');
        $this->expectException(ApiProblemException::class);
        $this->dates->lookup('A');
    }
}
