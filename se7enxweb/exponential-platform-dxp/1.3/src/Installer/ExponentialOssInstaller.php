<?php

/**
 * @copyright Copyright (C) 1998-2026 7x (se7enx.com). All rights reserved.
 * @license   GNU General Public License v2 or later
 *
 * Exponential Platform Legacy — installer type "exponential-oss".
 *
 * Registered as the "exponential-oss" installer type so that:
 *
 *   php bin/console ibexa:install exponential-oss
 *   php bin/console ezplatform:install exponential-oss   # deprecated alias, still works
 *
 * both resolve to this installer.  It delegates all work to the upstream
 * CoreInstaller (schema via SchemaBuilder + cleandata.sql seed data), making
 * it a drop-in equivalent of "ibexa-oss" under the Exponential Platform name.
 *
 * To customise the install — e.g. import additional demo content, extra SQL,
 * or skip certain steps — override importSchema(), importData(), or
 * importBinaries() here rather than patching vendor code.
 */

declare(strict_types=1);

namespace App\Installer;

use Doctrine\DBAL\Platforms\PostgreSQLPlatform;
use Doctrine\DBAL\Platforms\SqlitePlatform;
use Ibexa\Bundle\RepositoryInstaller\Installer\CoreInstaller;

/**
 * Installer for the "exponential-oss" install type.
 *
 * Extends CoreInstaller and additionally imports the Netgen Layouts schema
 * (nglayouts_* tables) so that the admin UI works out of the box on a fresh
 * installation without requiring a separate migration step.
 */
final class ExponentialOssInstaller extends CoreInstaller
{
    /**
     * Import the Ibexa schema (via SchemaBuilder) and then the Netgen Layouts
     * schema from its bundled SQL file.
     */
    public function importSchema(): void
    {
        parent::importSchema();
        $this->importNetgenLayoutsSchema();
    }

    /**
     * Load the DBMS-specific Netgen Layouts DDL file and execute it.
     *
     * File locations inside vendor/netgen/layouts-core:
     *  - MySQL      : resources/data/schema.mysql.sql
     *  - PostgreSQL : resources/data/schema.pgsql.sql
     *  - SQLite     : tests/_fixtures/schema/schema.sqlite.sql
     */
    private function importNetgenLayoutsSchema(): void
    {
        $platform = $this->db->getDatabasePlatform();
        $vendorDir = \dirname(__DIR__, 2) . '/vendor';

        if ($platform instanceof SqlitePlatform) {
            $schemaFile = $vendorDir . '/netgen/layouts-core/tests/_fixtures/schema/schema.sqlite.sql';
        } elseif ($platform instanceof PostgreSQLPlatform) {
            $schemaFile = $vendorDir . '/netgen/layouts-core/resources/data/schema.pgsql.sql';
        } else {
            $schemaFile = $vendorDir . '/netgen/layouts-core/resources/data/schema.mysql.sql';
        }

        if (!\is_readable($schemaFile)) {
            $this->output->writeln(
                '<comment>Netgen Layouts schema file not found, skipping: ' . $schemaFile . '</comment>'
            );

            return;
        }

        $this->runQueriesFromFile(\realpath($schemaFile));
    }
}
