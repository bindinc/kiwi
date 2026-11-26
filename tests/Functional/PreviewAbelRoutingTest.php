<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Address\AddressQuery;
use App\Address\LookupBudget;
use App\Address\WebaboAddressClient;
use App\Command\SyncWebaboOffersCommand;
use App\Entity\WebaboOffer;
use App\Repository\WebaboOfferRepository;
use App\SubscriptionApi\PersonSearchClient;
use App\Webabo\WebaboOfferCacheSchemaManager;
use App\Webabo\WebaboOfferClient;
use App\Webabo\WebaboSalesCodeCombinationClient;
use App\Webabo\WebaboStartDateClient;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Console\Tester\CommandTester;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class PreviewAbelRoutingTest extends KernelTestCase
{
    private string $configPath;
    private string|false $previousConfigPath;
    private string|false $previousPreview;

    protected function setUp(): void
    {
        parent::setUp();

        $this->previousConfigPath = getenv('KIWI_CLIENT_SECRETS_PATH');
        $this->previousPreview = getenv('KIWI_HUP_PREVIEW');
        $this->configPath = (string) tempnam(sys_get_temp_dir(), 'kiwi-preview-routing-');

        $abelO = [
            'webabo_base_url' => 'https://webabo-dev.example.test/webabo',
            'ppa_base_url' => 'https://ppa-dev.example.test/subscription',
            'hup_oidc_token' => 'https://dev-auth.example.test/token',
            'username' => 'fixture-reader',
            'password' => 'fixture-password',
        ];
        $abelT = [
            'webabo_base_url' => 'https://webabo-test.example.test/webabo',
            'hup_oidc_token' => 'https://test-auth.example.test/token',
        ] + $abelO;
        file_put_contents($this->configPath, json_encode([
            'hup' => ['webabo_base_url' => 'https://active.example.test/webabo'] + $abelO,
            'hup_preview' => $abelO,
            'hup_preview_offers' => $abelT,
        ], JSON_THROW_ON_ERROR));
        putenv('KIWI_CLIENT_SECRETS_PATH='.$this->configPath);
    }

    protected function tearDown(): void
    {
        parent::tearDown();
        $this->restoreEnvironment('KIWI_CLIENT_SECRETS_PATH', $this->previousConfigPath);
        $this->restoreEnvironment('KIWI_HUP_PREVIEW', $this->previousPreview);
        unlink($this->configPath);
    }

    public function testPreviewCatalogLookupsUseAbelTAndCustomerSearchUsesAbelO(): void
    {
        $container = $this->bootPreview([
            ['POST', 'https://test-auth.example.test/token', '{"access_token":"test-reader","expires_in":3600}'],
            ['GET', 'https://webabo-test.example.test/webabo/offers', '[{"salesCode":"PREVIEW","title":"Preview fixture"}]', 'test-reader'],
            ['POST', 'https://dev-auth.example.test/token', '{"access_token":"dev-reader","expires_in":3600}'],
            ['GET', 'https://ppa-dev.example.test/subscription/public/personsearch', '{"content":[]}', 'dev-reader'],
            ['GET', 'https://webabo-test.example.test/webabo/offers/salescodecombinations?productCode=GUIDE&refDate=2026-11-24', '[]', 'test-reader'],
            ['GET', 'https://webabo-test.example.test/webabo/subscriptions/start-dates?productCode=GUIDE&variantCode=EDIT', '{"startDate":"2026-12-01"}', 'test-reader'],
            ['POST', 'https://dev-auth.example.test/token', '{"access_token":"address-reader","expires_in":3600}'],
            ['POST', 'https://webabo-dev.example.test/webabo/addresses/search?limit=20', '[]', 'address-reader'],
        ]);

        $offers = $container->get(WebaboOfferClient::class)->fetchOffers();
        self::assertSame('webabo-test.example.test', $offers[0]['sourceHost']);
        $container->get(PersonSearchClient::class)->search([]);
        $container->get(WebaboSalesCodeCombinationClient::class)->fetchCombinations('default', 'GUIDE', new \DateTimeImmutable('2026-11-24'));
        $container->get(WebaboStartDateClient::class)->fetchStartDate('default', 'GUIDE', 'EDIT');
        $container->get(WebaboAddressClient::class)->search(new AddressQuery('1234AB', '1', ''), new LookupBudget());
    }

    public function testMissingPreviewOffersConfigDoesNotUseActiveCredentials(): void
    {
        $config = json_decode(file_get_contents($this->configPath), true, 512, JSON_THROW_ON_ERROR);
        unset($config['hup_preview_offers']);
        file_put_contents($this->configPath, json_encode($config, JSON_THROW_ON_ERROR));
        $container = $this->bootPreview([]);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Preview configuration section "hup_preview_offers" is missing.');
        $container->get(WebaboOfferClient::class)->fetchOffers();
    }

    public function testPreviewSyncKeepsActiveRowsAndReplacesOnlyPreviewRows(): void
    {
        putenv('KIWI_HUP_PREVIEW=0');
        $active = self::getContainer();
        $active->get(WebaboOfferCacheSchemaManager::class)->ensureSchema();
        $manager = $active->get(EntityManagerInterface::class);
        $activeOffer = new WebaboOffer('PREVIEW-ISOLATION-FIXTURE');
        $activeOffer->refreshFromWebaboPayload(['title' => 'Active fixture'], new \DateTimeImmutable());
        $manager->persist($activeOffer);
        $manager->flush();
        self::ensureKernelShutdown();

        $preview = $this->bootPreview([
            ['POST', 'https://test-auth.example.test/token', '{"access_token":"test-reader","expires_in":3600}'],
            ['GET', 'https://webabo-test.example.test/webabo/offers', '[{"salesCode":"PREVIEW-ISOLATION-FIXTURE","title":"Preview fixture"}]', 'test-reader'],
        ]);
        $schema = $preview->get(WebaboOfferCacheSchemaManager::class);
        $schema->ensureSchema();
        $manager = $preview->get(EntityManagerInterface::class);
        $manager->persist(new WebaboOffer('OUTDATED-PREVIEW-FIXTURE'));
        $manager->flush();

        $sync = new CommandTester($preview->get(SyncWebaboOffersCommand::class));
        self::assertSame(2, $sync->execute([]));
        self::assertSame(0, $sync->execute(['--preview' => true]), $sync->getDisplay());

        $catalog = $preview->get(WebaboOfferRepository::class);
        $offer = $catalog->findOneBySalesCode('PREVIEW-ISOLATION-FIXTURE');
        self::assertSame('Preview fixture', $offer?->getTitle());
        self::assertSame('webabo-test.example.test', $offer?->getRawPayload()['sourceHost']);
        self::assertNull($catalog->findOneBySalesCode('OUTDATED-PREVIEW-FIXTURE'));

        $connection = $manager->getConnection();
        self::assertSame('Active fixture', $connection->fetchOne(
            'SELECT title FROM webabo_offers_cache WHERE sales_code = ?',
            ['PREVIEW-ISOLATION-FIXTURE'],
        ));
        $connection->delete('webabo_offers_preview_cache', ['sales_code' => 'PREVIEW-ISOLATION-FIXTURE']);
        $connection->delete('webabo_offers_cache', ['sales_code' => 'PREVIEW-ISOLATION-FIXTURE']);
    }

    private function bootPreview(array $expected): \Psr\Container\ContainerInterface
    {
        putenv('KIWI_HUP_PREVIEW=1');
        $container = self::getContainer();
        $responses = [];
        foreach ($expected as $request) {
            [$method, $url, $json] = $request;
            $token = $request[3] ?? null;
            $responses[] = static function (string $actualMethod, string $actualUrl, array $options) use ($method, $url, $json, $token): MockResponse {
                self::assertSame($method, $actualMethod);
                self::assertSame($url, $actualUrl);
                self::assertSame(0, $options['max_redirects']);
                if (null !== $token) {
                    self::assertContains('Authorization: Bearer '.$token, $options['normalized_headers']['authorization']);
                }

                return new MockResponse($json);
            };
        }
        $http = new MockHttpClient($responses);
        $container->set('http_client', $http);
        $container->set('address.http_client', $http);

        return $container;
    }

    private function restoreEnvironment(string $name, string|false $value): void
    {
        putenv(false === $value ? $name : $name.'='.$value);
    }
}
